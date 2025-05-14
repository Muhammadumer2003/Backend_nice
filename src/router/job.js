const express = require('express');
const Jobrouter = express.Router();
const Job = require('../models/postJob.model.js');
const { UserMw } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const cloudinary = require('../config/cloudinary');

// Create a new job
Jobrouter.post('/client/jobs', UserMw, upload.array('attachments', 5), async (req, res) => {
  const user = req.user;
  const createdBy = user?._id;

  if (!user) {
    return res.status(401).json({ success: false, message: "User not authorized" });
  }

  if (user.role !== 'client') {
    return res.status(403).json({ success: false, message: "User not authorized to post jobs" });
  }

  try {
    if (!req.body.jobData) {
      return res.status(400).json({ success: false, message: "jobData is required" });
    }

    let jobData;
    try {
      jobData = JSON.parse(req.body.jobData);
    } catch (error) {
      return res.status(400).json({ success: false, message: "Invalid jobData format. Must be a valid JSON string." });
    }

    console.log('Received jobData:', jobData);
    console.log('Received files:', req.files);

    // Validate budget format before creating the job
    if (jobData.jobType === 'hourly') {
      if (!jobData.budget || typeof jobData.budget !== 'object' || !('min' in jobData.budget) || !('max' in jobData.budget)) {
        return res.status(400).json({ success: false, message: "Budget for hourly job must be an object with 'min' and 'max' properties" });
      }
    } else if (jobData.jobType === 'fixed') {
      if (typeof jobData.budget !== 'number') {
        return res.status(400).json({ success: false, message: "Budget for fixed job must be a number" });
      }
    }

    let attachments = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'job_attachments',
              resource_type: 'auto',
            },
            (error, result) => {
              if (error) {
                return reject(error);
              }
              resolve(result);
            }
          );
          uploadStream.end(file.buffer);
        });
      });

      const uploadResults = await Promise.all(uploadPromises);
      attachments = uploadResults.map(result => result.secure_url);
    }

    const job = new Job({
      title: jobData.title,
      description: jobData.description,
      jobType: jobData.jobType,
      createdBy,
      budget: jobData.budget,
      category: jobData.category,
      subCategory: jobData.subCategory || '',
      experienceLevel: jobData.experienceLevel || 'entry',
      projectScope: jobData.projectScope || 'small',
      duration: jobData.duration || 'less_than_1_month',
      skills: jobData.skills || [],
      location: jobData.location || 'worldwide',
      languages: jobData.languages || [],
      screeningQuestions: jobData.screeningQuestions || [],
      attachments,
    });

    await job.save();
    res.status(201).json({ success: true, job });
  } catch (error) {
    console.error('Error posting job:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get all jobs
Jobrouter.get('/client/getjobs', async (req, res) => {
  try {
    const jobs = await Job.find().populate('createdBy', 'fullname');
    res.status(200).json({ success: true, jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a single job by ID
Jobrouter.get('/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('createdBy', 'fullname');
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.status(200).json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update a job
Jobrouter.put('/jobs/:id', UserMw, async (req, res) => {
  try {
    const user = req.user;
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (String(job.createdBy) !== String(user._id)) {
      return res.status(403).json({ message: 'Unauthorized: Only the job creator can update this job' });
    }

    const updatedJob = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, job: updatedJob });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update job status (e.g., mark as completed)
Jobrouter.put('/jobs/:id/status', UserMw, async (req, res) => {
  try {
    const user = req.user;
    const { status } = req.body;
    const job = await Job.findById(req.params.id);
    
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (String(job.createdBy) !== String(user._id)) {
      return res.status(403).json({ message: 'Unauthorized: Only the job creator can update this job' });
    }
    if (!['Ongoing', 'Completed'].includes(status)) {
      return res.status(400).json({ message: "Status must be 'Ongoing' or 'Completed'" });
    }

    job.status = status;
    await job.save();
    res.status(200).json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a job
Jobrouter.delete('/jobs/:id', UserMw, async (req, res) => {
  try {
    const user = req.user;
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (String(job.createdBy) !== String(user._id)) {
      return res.status(403).json({ message: 'Unauthorized: Only the job creator can delete this job' });
    }
    await Job.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = Jobrouter;