// const mongoose = require('mongoose');

// const proposalSchema = new mongoose.Schema({
//   jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
//   freelancerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ID of the freelancer submitting the proposal
//   proposalText: { type: String, required: true }, // Proposal description
//   bidAmount: { type: Number, required: true }, // Bid amount
//   submittedAt: { type: Date, default: Date.now }, // Submission timestamp
// });

// module.exports = mongoose.model('Proposal', proposalSchema);






// models/proposal.model.js
const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proposalText: { type: String, required: true },
  bidAmount: { type: Number, required: true },
  attachments: [{ type: String }], // Array of file URLs
  status: { 
    type: String, 
    enum: ['Pending', 'Accepted', 'Rejected'], 
    default: 'Pending' 
  },
  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Proposal', proposalSchema);
