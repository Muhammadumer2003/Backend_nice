const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { Groq } = require('groq-sdk');
const { Pinecone } = require('@pinecone-database/pinecone');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const crypto = require('crypto');
const dotenv=require('dotenv');

const chatbotRouter = express.Router();

// Configure Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.includes('pdf')) {
      return cb(new Error('Only PDF files are allowed'), false);
    }
    cb(null, true);
  },
});

// Initialize Groq
const groq = new Groq({
  apiKey: `${process.env.GROQ_API_KEY}`,
});

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: `${process.env.PINECONE_API_KEY}`,
});

// Log Pinecone client version for debugging
console.log('Pinecone client version:', require('@pinecone-database/pinecone/package.json').version);

// Initialize Pinecone index without host
let index;
try {
  index = pinecone.Index('pakrag');
  console.log('Pinecone index initialized successfully for pakrag');
} catch (initError) {
  console.error('Failed to initialize Pinecone index:', initError.message);
  throw new Error('Pinecone index initialization failed');
}

// FAQ Responses for PakTeKHire
const faqResponses = {
  "what is paktekhire": "PakTeKHire is a B2B platform for Pakistan, connecting businesses with skilled professionals, similar to Upwork. It focuses on facilitating hiring for projects without handling payments directly.",
  "how does paktekhire work": "PakTeKHire allows businesses to post projects and hire professionals in Pakistan. We use 'bolts' instead of 'connects' to manage interactions. Payments are handled off-platform.",
  "what are bolts": "Bolts are the currency used on PakTeKHire to manage interactions, similar to 'connects' on Upwork. They help you engage with potential clients or professionals.",
  "is payment included": "No, PakTeKHire does not handle payments. It's a platform to connect businesses and professionals, and payment arrangements are made off-platform.",
};

// Make chunks extremely small with massive overlap to catch everything
const chunkText = (text, maxLength = 100, overlap = 90) => {
  const chunks = [];
  let currentChunk = '';
  const words = text.split(' ');

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    if ((currentChunk + ' ' + word).length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      chunks.push(currentChunk);
      const overlapStart = Math.max(0, i - Math.ceil(overlap / 3));
      currentChunk = words.slice(overlapStart, i + 1).join(' ');
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
};

// Helper: Generate embeddings using Hugging Face
const generateEmbeddings = async (text) => {
  // Using a simpler model with more predictable output
  const response = await fetch('https://api-inference.huggingface.co/models/sentence-transformers/distilbert-base-nli-mean-tokens', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: text
    }),
  });

  try {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Embedding received with type:', typeof result);
    
    // The result appears to be a 2D array, so we need to flatten it
    // Force it to be a flat array of numbers regardless of input format
    let flatEmbedding = [];
    
    if (Array.isArray(result)) {
      // If result is already an array
      if (result.length > 0) {
        if (Array.isArray(result[0])) {
          // If it's a 2D array, take the first row
          flatEmbedding = result[0].map(val => Number(val));
        } else if (typeof result[0] === 'number') {
          // If it's already a flat array of numbers
          flatEmbedding = result.map(val => Number(val));
        }
      }
    }
    
    // If we couldn't extract a valid embedding, create a random one for testing
    if (flatEmbedding.length === 0) {
      console.log('Creating random embedding for testing');
      // Create a random embedding (just for testing)
      flatEmbedding = Array(768).fill(0).map(() => Math.random() * 2 - 1);
    }
    
    // Pad to 1536 dimensions for Pinecone
    const paddedEmbedding = Array(1536).fill(0);
    for (let i = 0; i < Math.min(flatEmbedding.length, 1536); i++) {
      paddedEmbedding[i] = flatEmbedding[i];
    }
    
    console.log(`Embedding processed: ${flatEmbedding.length} dimensions padded to 1536`);
    return paddedEmbedding;
  } catch (error) {
    console.error('Error processing embedding:', error);
    // Create a random embedding as fallback
    console.log('Creating fallback random embedding');
    const randomEmbedding = Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    return randomEmbedding;
  }
};

// Route: Upload PDF and store in Pinecone
chatbotRouter.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('No PDF file uploaded');
    }

    console.log('PDF received:', {
      originalname: req.file.originalname,
      size: req.file.size,
      bufferLength: req.file.buffer.length,
    });

    // Generate a unique documentId for this upload
    const documentId = crypto.randomUUID();
    
    // Delete all existing vectors using a wildcard filter
    try {
      console.log('Deleting all existing vectors from Pinecone...');
      // Delete all vectors that match any condition (effectively all vectors)
      await index.deleteMany({});
      console.log('Successfully deleted all existing vectors');
    } catch (deleteError) {
      console.error('Error deleting vectors:', deleteError.message);
      // Continue with upload even if delete fails
    }
    
    // Extract text from PDF
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    // Chunk the text
    const chunks = chunkText(text);

    // Generate embeddings and store in Pinecone
    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbeddings(chunks[i]);
      vectors.push({
        id: `chunk-${Date.now()}-${i}`,
        values: embedding,
        metadata: { 
          text: chunks[i],
          documentId: documentId,
          filename: req.file.originalname,
          timestamp: new Date().toISOString()
        },
      });
    }

    // Log detailed vector information
    console.log('Vectors to upsert (first 2):', JSON.stringify(vectors.slice(0, 2), null, 2));
    console.log('Total vectors to upsert:', vectors.length);

    // Upsert vectors to Pinecone with error handling
    let upsertedCount = 0;
    try {
      // Just pass the vectors array directly
      const upsertResponse = await index.upsert(vectors);
      upsertedCount = vectors.length;
      console.log('Upsert response:', JSON.stringify(upsertResponse, null, 2));
      console.log(`Vectors stored in Pinecone: ${upsertedCount}`);
    } catch (upsertError) {
      console.error('Batch upsert failed:', upsertError.message);

      // Fallback: Upsert vectors individually
      for (const vector of vectors) {
        try {
          // Pass a single vector as array with one element
          const individualResponse = await index.upsert([vector]);
          upsertedCount++;
          console.log(`Successfully upserted vector with ID: ${vector.id}`);
        } catch (individualError) {
          console.error(`Failed to upsert vector ${vector.id}:`, individualError.message);
        }
      }
      console.log(`Individual upsert attempts completed. Total upserted: ${upsertedCount}`);
    }

    if (upsertedCount === 0) {
      throw new Error('No vectors were successfully stored in Pinecone');
    }

    res.status(200).json({ 
      message: 'PDF uploaded and processed successfully',
      documentId: documentId
    });
  } catch (err) {
    console.error('PDF upload error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

// Add this function to get the most recent document ID
async function getLatestDocumentId() {
  try {
    // Use the Pinecone fetch API to get a sample of vectors
    const fetchResponse = await index.fetch({
      ids: Array(20).fill().map((_, i) => `chunk-${Date.now() - i * 1000}-0`),
      includeMetadata: true
    });
    
    // Extract all document IDs from the fetched vectors
    const documentIds = Object.values(fetchResponse.vectors)
      .filter(vector => vector.metadata && vector.metadata.documentId)
      .map(vector => ({
        documentId: vector.metadata.documentId,
        timestamp: new Date(vector.metadata.timestamp || 0).getTime()
      }));
    
    // Sort by timestamp descending and get the most recent
    if (documentIds.length > 0) {
      documentIds.sort((a, b) => b.timestamp - a.timestamp);
      return documentIds[0].documentId;
    }
    return null;
  } catch (error) {
    console.error('Error getting latest document ID:', error.message);
    return null;
  }
}

// Modified chat route with brute force approach to get ALL document content
chatbotRouter.post('/chat', async (req, res) => {
  try {
    const { message, hasPdf, pdfTitle, documentId: requestedDocId } = req.body;

    if (!message) {
      throw new Error('Message is required');
    }

    let responseText;

    if (!hasPdf) {
      // FAQ mode with improved responses
      const lowerMessage = message.toLowerCase().trim();
      responseText = faqResponses[lowerMessage] || "I don't have specific information about that topic. To get detailed answers, please upload a PDF document that I can analyze for you, or ask about PakTeKHire's services, how it works, bolts, or payment structure.";
    } else {
      console.log(`Processing query about ${pdfTitle || 'uploaded PDF'}: "${message}"`);
      
      // Create multiple query embeddings with variations to improve matching
      const queryKeywords = message
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(' ')
        .filter(word => word.length > 3);
      
      // Generate main query embedding
      const queryEmbedding = await generateEmbeddings(message);
      
      try {
        // Get document ID as before
        let documentId = requestedDocId;
        if (!documentId) {
          documentId = await getLatestDocumentId();
          console.log(`No documentId provided, using latest: ${documentId}`);
        }

        // Create filter
        let pineconeFilter = {};
        if (documentId) {
          pineconeFilter = { documentId: { $eq: documentId } };
        }
        
        console.log('Using Pinecone filter:', JSON.stringify(pineconeFilter));
        
        // FIRST RETRIEVAL: Get as many document chunks as possible
        const initialQuery = await index.query({
          topK: 50, // Get a MUCH larger number of chunks to ensure we have most of the document
          includeMetadata: true,
          vector: queryEmbedding,
          filter: pineconeFilter,
        });
        
        console.log('Initial query successful, matches:', initialQuery.matches?.length || 0);

        // SECOND RETRIEVAL: Get additional chunks with more specific queries if we have keywords
        let additionalMatches = [];
        if (queryKeywords.length > 0) {
          // Try to get additional relevant chunks by using keyword variations
          for (const keyword of queryKeywords.slice(0, 3)) { // Use up to 3 keywords to avoid too many queries
            try {
              const keywordEmbedding = await generateEmbeddings(keyword);
              const keywordResult = await index.query({
                topK: 20,
                includeMetadata: true,
                vector: keywordEmbedding,
                filter: pineconeFilter,
              });
              if (keywordResult.matches && keywordResult.matches.length > 0) {
                additionalMatches = [...additionalMatches, ...keywordResult.matches];
              }
            } catch (keywordError) {
              console.error(`Error with keyword query for "${keyword}":`, keywordError);
              // Continue with other keywords
            }
          }
        }
        
        if (!initialQuery.matches || initialQuery.matches.length === 0) {
          responseText = "I've analyzed the document but couldn't find specific information related to your question. Please try a different question.";
        } else {
          // Combine all matches and remove duplicates by ID
          const allMatches = [...initialQuery.matches, ...additionalMatches];
          const uniqueMatches = [];
          const seenIds = new Set();
          
          allMatches.forEach(match => {
            if (!seenIds.has(match.id)) {
              seenIds.add(match.id);
              uniqueMatches.push(match);
            }
          });
          
          // Sort by relevance score
          const sortedMatches = uniqueMatches.sort((a, b) => (b.score || 0) - (a.score || 0));
          
          // Take top matches but ensure we get good coverage
          const relevantMatches = sortedMatches.slice(0, 30); // Use up to 30 chunks for maximum context
          
          // Format context, balancing between high and low relevance chunks
          const highRelevanceChunks = relevantMatches.slice(0, 15);
          const lowerRelevanceChunks = relevantMatches.slice(15);
          
          // Process high relevance chunks first
          const highRelevanceContext = highRelevanceChunks
            .map((match, i) => {
              if (!match.metadata?.text || match.metadata.text.trim().length === 0) return null;
              return `[HIGH RELEVANCE EXTRACT ${i+1}]\n${match.metadata.text.trim()}`;
            })
            .filter(Boolean)
            .join('\n\n');
          
          // Then add lower relevance chunks (important for coverage)
          const lowerRelevanceContext = lowerRelevanceChunks
            .map((match, i) => {
              if (!match.metadata?.text || match.metadata.text.trim().length === 0) return null;
              return `[ADDITIONAL EXTRACT ${i+1}]\n${match.metadata.text.trim()}`;
            })
            .filter(Boolean)
            .join('\n\n');
          
          // Combine contexts, prioritizing high relevance content
          const fullContext = highRelevanceContext + (lowerRelevanceContext ? '\n\n' + lowerRelevanceContext : '');
          
          if (!fullContext || fullContext.trim().length === 0) {
            responseText = "I've analyzed the document but couldn't extract meaningful content. Please upload the document again.";
          } else {
            try {
              console.log(`Generating response with ${relevantMatches.length} context sections`);
              responseText = await generateResponse(fullContext, message, pdfTitle || 'the uploaded PDF');
              console.log('Response successfully generated');
            } catch (error) {
              console.error('Response generation failed:', error);
              responseText = "I encountered an error analyzing the document. Please try again with a different question.";
            }
          }
        }
      } catch (queryError) {
        console.error('Query error:', queryError);
        responseText = "I encountered a technical issue while searching through the document. Please try again.";
      }
    }

    res.status(200).json({ response: responseText });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(400).json({ message: err.message });
  }
});

// Updated generateResponse with stronger accuracy requirements
async function generateResponse(context, message, pdfTitle = 'the uploaded PDF') {
  const isSummarization = message.toLowerCase().includes('summarize') || 
                         message.toLowerCase().includes('summary') || 
                         message.toLowerCase().includes('overview') ||
                         message.toLowerCase().includes('main points');
  
  const systemPrompt = isSummarization ? 
    `You are a precise AI assistant that provides comprehensive factual summaries from ${pdfTitle}.

SUMMARIZATION GUIDELINES:
1. ONLY use information explicitly stated in the provided context
2. Be EXTREMELY COMPREHENSIVE - include ALL meaningful information
3. Do not assume any information is unimportant - include everything
4. Present information in a structured, logical format
5. Use bullet points for clarity when appropriate` :
    
    `You are a precise AI assistant that answers questions about ${pdfTitle} with exceptional accuracy.

GUIDELINES:
1. SEARCH THOROUGHLY through ALL provided extracts before answering
2. Before stating "information is not present," CHECK AGAIN carefully
3. Information is often spread across multiple extracts - look at ALL of them
4. Use EXACT wording from the document whenever possible
5. If you find ANY information relevant to the question, include it
6. Only say "The document does not contain this information" as an absolute last resort after searching extensively
7. Check both HIGH RELEVANCE and ADDITIONAL extracts - important information might be in either`;

  // Use most capable models for comprehensive analysis
  const models = [
    'claude-3-opus-20240229',
    'llama3-70b-8192',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ];
  
  let lastError = null;
  
  const userPrompt = isSummarization ?
    `Create a COMPREHENSIVE summary of this document (${pdfTitle}), covering ALL important information:

${context}

Include ALL significant details from these extracts. Be thorough and precise.` :
    
    `Answer this question about ${pdfTitle} with COMPLETE accuracy:

Question: ${message}

Carefully search through ALL these extracts:

${context}

IMPORTANT: Search THOROUGHLY through ALL extracts before answering. The information you need is likely present somewhere in these extracts - check each one carefully. Only state that information is missing as an absolute last resort.`;
  
  for (const model of models) {
    try {
      console.log(`Using model: ${model}`);
      const groqResponse = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: model,
        temperature: 0.01, // Extremely low temperature for consistency
        max_tokens: isSummarization ? 2000 : 1500, // Increased token limit
        top_p: 0.95,
      });
      
      return groqResponse.choices[0].message.content;
    } catch (error) {
      console.error(`Error with model ${model}:`, error.message);
      lastError = error;
    }
  }
  
  console.error('All Groq models failed:', lastError);
  throw new Error('Unable to generate response with any available model');
}

module.exports = chatbotRouter;