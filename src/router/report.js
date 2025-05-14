const express = require('express');
const Reportrouter = express.Router();
const Proposal = require('../models/proposal.model.js');
const Job = require('../models/postJob.model.js');
const { UserMw } = require('../middlewares/auth');

// Helper function to calculate trends (simplified)
const calculateTrend = (current, previous) => {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const trend = ((current - previous) / previous) * 100;
  return `${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`;
};

// GET /freelancer/reports/:userId
Reportrouter.get('/freelancer/reports/:userId', UserMw, async (req, res) => {
  try {
    const user = req.user;
    const userId = req.params.userId;

    if (!user || String(user._id) !== String(userId)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (user.role !== 'Freelancer') {
      return res.status(403).json({ message: 'Only freelancers can view reports' });
    }

    // Fetch all proposals for the freelancer
    const proposals = await Proposal.find({ freelancerId: userId })
      .populate('jobId', 'jobType budget createdAt createdBy')
      .lean();

    if (!proposals.length) {
      return res.status(200).json({
        totalEarnings: 0,
        activeProjects: 0,
        completionRate: 0,
        hoursWorked: 0,
        earningsTrend: '0%',
        projectsTrend: '0',
        completionTrend: '0%',
        hoursTrend: '0h',
        chartsData: { earnings: [], projects: [] },
      });
    }

    // Calculate total earnings (sum of bidAmount for accepted proposals)
    const acceptedProposals = proposals.filter(p => p.status === 'Accepted');
    const totalEarnings = acceptedProposals.reduce((sum, p) => sum + p.bidAmount, 0);

    // Calculate active projects (accepted proposals)
    const activeProjects = acceptedProposals.length;

    // Calculate completion rate (accepted / total proposals)
    const totalProposals = proposals.length;
    const completionRate = totalProposals > 0 ? ((acceptedProposals.length / totalProposals) * 100).toFixed(1) : 0;

    // Estimate hours worked (simplified: bidAmount / 1000 PKR per hour for hourly jobs)
    const hoursWorked = acceptedProposals.reduce((sum, p) => {
      if (p.jobId.jobType === 'Hourly') {
        return sum + (p.bidAmount / 1000); // Assuming 1000 PKR/hour
      }
      return sum;
    }, 0).toFixed(1);

    // Calculate trends (last 30 days vs previous 30 days)
    const now = new Date();
    const last30Days = new Date(now.setDate(now.getDate() - 30));
    const prev30Days = new Date(now.setDate(now.getDate() - 30));

    const recentEarnings = acceptedProposals
      .filter(p => new Date(p.submittedAt) >= last30Days)
      .reduce((sum, p) => sum + p.bidAmount, 0);
    const prevEarnings = acceptedProposals
      .filter(p => new Date(p.submittedAt) < last30Days && new Date(p.submittedAt) >= prev30Days)
      .reduce((sum, p) => sum + p.bidAmount, 0);
    const earningsTrend = calculateTrend(recentEarnings, prevEarnings);

    const recentProjects = acceptedProposals.filter(p => new Date(p.submittedAt) >= last30Days).length;
    const prevProjects = acceptedProposals.filter(p => new Date(p.submittedAt) < last30Days && new Date(p.submittedAt) >= prev30Days).length;
    const projectsTrend = recentProjects - prevProjects;

    const recentCompletion = totalProposals > 0 ? ((recentProjects / totalProposals) * 100).toFixed(1) : 0;
    const prevCompletion = totalProposals > 0 ? ((prevProjects / totalProposals) * 100).toFixed(1) : 0;
    const completionTrend = calculateTrend(recentCompletion, prevCompletion);

    const recentHours = acceptedProposals
      .filter(p => p.jobId.jobType === 'Hourly' && new Date(p.submittedAt) >= last30Days)
      .reduce((sum, p) => sum + (p.bidAmount / 1000), 0).toFixed(1);
    const prevHours = acceptedProposals
      .filter(p => p.jobId.jobType === 'Hourly' && new Date(p.submittedAt) < last30Days && new Date(p.submittedAt) >= prev30Days)
      .reduce((sum, p) => sum + (p.bidAmount / 1000), 0).toFixed(1);
    const hoursTrend = `${(recentHours - prevHours).toFixed(1)}h`;

    // Generate sample chart data (last 6 months)
    const chartsData = {
      earnings: Array.from({ length: 6 }, (_, i) => {
        const month = new Date();
        month.setMonth(month.getMonth() - (5 - i));
        const monthEarnings = acceptedProposals
          .filter(p => {
            const pDate = new Date(p.submittedAt);
            return pDate.getMonth() === month.getMonth() && pDate.getFullYear() === month.getFullYear();
          })
          .reduce((sum, p) => sum + p.bidAmount, 0);
        return { month: month.toLocaleString('default', { month: 'short' }), value: monthEarnings };
      }),
      projects: Array.from({ length: 6 }, (_, i) => {
        const month = new Date();
        month.setMonth(month.getMonth() - (5 - i));
        const monthProjects = acceptedProposals
          .filter(p => {
            const pDate = new Date(p.submittedAt);
            return pDate.getMonth() === month.getMonth() && pDate.getFullYear() === month.getFullYear();
          }).length;
        return { month: month.toLocaleString('default', { month: 'short' }), value: monthProjects };
      }),
    };

    res.status(200).json({
      totalEarnings,
      activeProjects,
      completionRate,
      hoursWorked,
      earningsTrend,
      projectsTrend,
      completionTrend,
      hoursTrend,
      chartsData,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Failed to fetch reports' });
  }
});

module.exports = Reportrouter;