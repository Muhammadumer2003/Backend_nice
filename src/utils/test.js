const { Pinecone } = require('@pinecone-database/pinecone');

const pinecone = new Pinecone({
  apiKey: 'pcsk_xuBU7_EYVFcUHYhvU1wqG9Qh37X2PZg43m2t9Gzgow2T8w1kvaRqa3mho5hfh8D8pD8Tr',
});

(async () => {
  try {
    const index = pinecone.Index('pakrag');
    const vectors = [{
      id: 'test-vector',
      values: new Array(1536).fill(0),
      metadata: { text: 'test' },
    }];
    const upsertResponse = await index.upsert(vectors);
    console.log('Upsert successful:', upsertResponse);
  } catch (error) {
    console.error('Upsert failed:', error.message);
    if (error.response) {
      console.error('Response details:', error.response.data);
    }
  }
})();