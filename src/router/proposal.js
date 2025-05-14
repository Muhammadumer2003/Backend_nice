const express = require('express');
const mongoose = require('mongoose');
const Proposal = require('../models/proposal.model.js');
const Job = require("../models/postJob.model.js");
const upload = require('../middlewares/upload');
const { UserMw } = require("../middlewares/auth");
const cloudinary = require('../config/cloudinary');

const Proposalrouter = express.Router();

// Existing routes...

// GET /api/proposals/:id - Fetch a single proposal by ID
Proposalrouter.get('/api/proposals/:id', UserMw, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid Proposal ID" });
    }

    const proposal = await Proposal.findById(id)
      .populate({
        path: "jobId",
        select: "jobTitle jobDescription jobType createdBy createdAt budget status",
        populate: {
          path: "createdBy",
          select: "_id fullname avatar",
        },
      })
      .lean();

    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    // Ensure the user can only view their own proposals
    if (String(proposal.freelancerId) !== String(user._id)) {
      return res.status(403).json({ message: "Unauthorized: You can only view your own proposals" });
    }

    res.status(200).json(proposal);
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({ message: 'Failed to fetch proposal' });
  }
});

// ... Rest of the existing routes (unchanged)

Proposalrouter.post('/api/proposals/:jobId', UserMw, upload.array('attachments', 5), async (req, res) => {
  try {
    const user = req.user;
    const freelancerId = user?._id;
    const { jobId } = req.params;
    const { proposalText, bidAmount } = req.body;

    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "Freelancer") return res.status(403).json({ message: "Only freelancers can submit proposals" });
    if (!mongoose.isValidObjectId(jobId)) return res.status(400).json({ message: "Invalid Job ID" });

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const existingProposal = await Proposal.findOne({ jobId, freelancerId });
    if (existingProposal) return res.status(400).json({ message: "Already applied" });

    // Debug: Log the received files
    console.log('Received files:', req.files);

    // Upload files to Cloudinary using buffers
    let attachments = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'proposals',
              resource_type: 'auto',
            },
            (error, result) => {
              if (error) {
                return reject(error);
              }
              resolve(result);
            }
          );
          uploadStream.end(file.buffer); // Use buffer for memory storage
        });
      });

      const uploadResults = await Promise.all(uploadPromises);
      attachments = uploadResults.map(result => result.secure_url);
    }

    const proposal = new Proposal({
      jobId,
      freelancerId,
      proposalText,
      bidAmount: parseFloat(bidAmount),
      attachments,
    });

    await proposal.save();
    res.status(201).json({ message: 'Proposal submitted successfully!', proposal });
  } catch (error) {
    console.error('Error submitting proposal:', error);
    res.status(500).json({ message: 'Failed to submit proposal', error: error.message });
  }
});

// GET /api/proposals/:jobId
Proposalrouter.get('/api/proposals/:jobId', UserMw, async (req, res) => {
  try {
    const { jobId } = req.params;
    const user = req.user;

    if (!mongoose.isValidObjectId(jobId)) return res.status(400).json({ message: "Invalid Job ID" });

    const proposals = await Proposal.find({ jobId })
      .populate('freelancerId', 'fullname email profilePicture')
      .sort({ submittedAt: -1 });

    if (!proposals.length) return res.status(404).json({ message: "No proposals found" });

    res.status(200).json(proposals);
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({ message: 'Failed to fetch proposals' });
  }
});

// ... Other existing routes (unchanged)

Proposalrouter.get('/api/client/jobs/proposals', UserMw, async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (user.role !== "client")
      return res.status(403).json({ message: "Only clients allowed" });

    const jobs = await Job.find({ createdBy: user._id }).sort({ createdAt: -1 });
    const jobIds = jobs.map(job => job._id);
    const proposals = await Proposal.find({ jobId: { $in: jobIds } })
      .populate('freelancerId', 'fullname email')
      .sort({ submittedAt: -1 });

    res.status(200).json({ jobs, proposals });
  } catch (error) {
    console.error('Error fetching jobs and proposals for client:', error);
    res.status(500).json({ message: 'Failed to fetch jobs and proposals' });
  }
});

Proposalrouter.put('/api/proposals/:id/status', UserMw, async (req, res) => {
  try {
    const user = req.user;
    const { status } = req.body;
    const { id } = req.params;

    if (!['Accepted', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: "Status must be 'Accepted' or 'Rejected'" });
    }

    const proposal = await Proposal.findById(id).populate('jobId');
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });

    if (String(proposal.jobId.createdBy) !== String(user._id)) {
      return res.status(403).json({ message: "You can only update proposals for your own jobs" });
    }

    proposal.status = status;
    await proposal.save();

    res.status(200).json({ message: `Proposal ${status.toLowerCase()} successfully`, proposal });
  } catch (error) {
    console.error('Error updating proposal status:', error);
    res.status(500).json({ message: 'Error updating proposal status' });
  }
});

// Proposalrouter.get("/api/freelancer/proposals", UserMw, async (req, res) => {
//   try {
//     const user = req.user;
//     if (!user) return res.status(401).json({ message: "Unauthorized" });
//     if (user.role !== "Freelancer")
//       return res.status(403).json({ message: "Only freelancers allowed" });

//     const proposals = await Proposal.find({ freelancerId: user._id })
//       .populate({
//         path: "jobId",
//         select: "title description jobType createdBy createdAt budget",
//         populate: {
//           path: "createdBy",
//           select: "_id fullname avatar",
//         },
//       })
//       .sort({ submittedAt: -1 })
//       .lean();

//     const validProposals = proposals.filter((proposal) => {
//       if (!proposal.jobId) {
//         console.warn(`Proposal ${proposal._id} has an invalid jobId: ${proposal.jobId}`);
//         return false;
//       }
//       return true;
//     });

//     const formattedProposals = validProposals.map((proposal) => ({
//       _id: proposal?._id,
//       jobId: proposal?.jobId._id,
//       job: {
//         title: proposal?.jobId.title,
//         description: proposal?.jobId.description,
//         jobType: proposal?.jobId.jobType,
//         createdAt: proposal?.jobId.createdAt,
//         category: proposal?.jobId.category,
//         expertise: "Intermediate",
//         skills: [],
//         createdBy: proposal?.jobId.createdBy?._id,
//         createdByName: proposal?.jobId.createdBy?.fullname,
//         createdByAvatar: proposal?.jobId.createdBy?.avatar || "/api/placeholder/40/40",
//         budget: proposal?.jobId.budget,
//       },
//       bidAmount: proposal?.bidAmount,
//       status: proposal?.status,
//       submittedAt: proposal?.submittedAt,
//       proposalText: proposal?.proposalText,
//       attachments: proposal?.attachments || [],
//     }));

//     res.status(200).json(formattedProposals);
//   } catch (error) {
//     console.error("Error fetching freelancer proposals:", error);
//     res.status(500).json({ message: "Failed to fetch proposals" });
//   }
// });



Proposalrouter.get("/api/freelancer/proposals", UserMw, async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "Freelancer")
      return res.status(403).json({ message: "Only freelancers allowed" });

    const proposals = await Proposal.find({ freelancerId: user._id })
      .populate({
        path: "jobId",
        select: "title description jobType createdBy createdAt budget category subCategory experienceLevel projectScope duration skills location languages screeningQuestions attachments",
        populate: {
          path: "createdBy",
          select: "_id fullname avatar",
        },
      })
      .sort({ submittedAt: -1 })
      .lean();

    const validProposals = proposals.filter((proposal) => {
      if (!proposal.jobId) {
        console.warn(`Proposal ${proposal._id} has an invalid jobId: ${proposal.jobId}`);
        return false;
      }
      return true;
    });

    const formattedProposals = validProposals.map((proposal) => ({
      _id: proposal?._id,
      jobId: proposal?.jobId._id,
      job: {
        title: proposal?.jobId.title,
        description: proposal?.jobId.description,
        jobType: proposal?.jobId.jobType,
        createdAt: proposal?.jobId.createdAt,
        category: proposal?.jobId.category,
        subCategory: proposal?.jobId.subCategory,
        experienceLevel: proposal?.jobId.experienceLevel,
        projectScope: proposal?.jobId.projectScope,
        duration: proposal?.jobId.duration,
        skills: proposal?.jobId.skills || [],
        location: proposal?.jobId.location,
        languages: proposal?.jobId.languages || [],
        screeningQuestions: proposal?.jobId.screeningQuestions || [],
        attachments: proposal?.jobId.attachments || [],
        createdBy: proposal?.jobId.createdBy?._id,
        createdByName: proposal?.jobId.createdBy?.fullname,
        createdByAvatar: proposal?.jobId.createdBy?.avatar || "/api/placeholder/40/40",
        budget: proposal?.jobId.budget,
      },
      bidAmount: proposal?.bidAmount,
      status: proposal?.status,
      submittedAt: proposal?.submittedAt,
      proposalText: proposal?.proposalText,
      attachments: proposal?.attachments || [],
    }));

    res.status(200).json(formattedProposals);
  } catch (error) {
    console.error("Error fetching freelancer proposals:", error);
    res.status(500).json({ message: "Failed to fetch proposals" });
  }
});

Proposalrouter.post('/api/client/proposals/:id/hire', async (req, res) => {
  try {
    const updatedProposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      { status: 'Accepted' },
      { new: true }
    );

    if (!updatedProposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    res.status(200).json(updatedProposal);
  } catch (error) {
    console.error('Error hiring freelancer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

Proposalrouter.post('/api/client/proposals/:id/reject', async (req, res) => {
  try {
    const updatedProposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      { status: 'Rejected' },
    );

    if (!updatedProposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    res.status(200).json(updatedProposal);
  } catch (error) {
    console.error('Error rejecting freelancer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = Proposalrouter;