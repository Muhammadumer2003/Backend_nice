const express = require('express');
const { UserMw } = require('../middlewares/auth');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const dotenv=require('dotenv');
// require('dotenv').config(); // Uncomment if you move credentials to .env

const zoomRouter = express.Router();

// Use the provided credentials directly (move to .env for production)
const ZOOM_ACCOUNT_ID = `gwRchv0SQdC_2dbTAqrvLQ`;
const ZOOM_API_BASE_URL = `https://api.zoom.us/v2`;
const ZOOM_CLIENT_ID = `uvRu1mzQRoWR2pRU08oUQg`;
const ZOOM_CLIENT_SECRET = `GDZFsS2o2tRrf6hedVt65gU2UPkHBZw3`;
const ZOOM_API_KEY = `uvRu1mzQRoWR2pRU08oUQg`; // Typically, API Key is the same as Client ID for JWT
const ZOOM_API_SECRET = `GDZFsS2o2tRrf6hedVt65gU2UPkHBZw3`; // Typically, API Secret is the same as Client Secret for JWT

let accessToken = null;
let tokenExpiration = null;

// Function to get or refresh OAuth access token
// async function getOrRefreshAccessToken() {
//   if (accessToken && tokenExpiration > Date.now()) {
//     return accessToken;
//   }

//   const auth = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');
//   try {
//     const response = await axios.post(
//       'https://zoom.us/oauth/token',
//       new URLSearchParams({
//         grant_type: 'account_credentials',
//         account_id: ZOOM_ACCOUNT_ID,
//       }),
//       {
//         headers: {
//           Authorization: `Basic ${auth}`,
//           'Content-Type': 'application/x-www-form-urlencoded',
//         },
//       }
//     );

//     accessToken = response.data.access_token;
//     tokenExpiration = Date.now() + response.data.expires_in * 1000 - 60000; // Subtract 1 minute for safety
//     return accessToken;
//   } catch (error) {
//     console.error('Error fetching access token:', error.response?.data || error.message);
//     throw new Error('Failed to obtain Zoom access token');
//   }
// }

async function getOrRefreshAccessToken() {
  if (accessToken && tokenExpiration > Date.now()) {
    return accessToken;
  }

  const auth = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');
  try {
    const response = await axios.post(
      'https://zoom.us/oauth/token',
      new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: ZOOM_ACCOUNT_ID,
      }),
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    accessToken = response.data.access_token;
    tokenExpiration = Date.now() + response.data.expires_in * 1000 - 60000;
    console.log('New access token fetched, expires at:', new Date(tokenExpiration));
    return accessToken;
  } catch (error) {
    console.error('Error fetching access token:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw new Error('Failed to obtain Zoom access token: ' + (error.response?.data?.message || error.message));
  }
}

// Function to generate Zoom JWT signature for Web SDK
// function generateSignature(apiKey, apiSecret, meetingNumber, role) {
//   const iat = Math.floor(Date.now() / 1000) - 30; // Issued at, 30 seconds in the past
//   const exp = iat + 60 * 60 * 2; // Expires in 2 hours

//   const payload = {
//     appKey: apiKey,
//     sdkKey: apiKey, // SDK Key is typically the same as API Key
//     mn: meetingNumber,
//     role: role, // 0 for participant, 1 for host
//     iat: iat,
//     exp: exp,
//     tokenExp: exp,
//   };

//   return jwt.sign(payload, apiSecret, { algorithm: 'HS256' });
// }

function generateSignature(apiKey, apiSecret, meetingNumber, role) {
  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;
  const payload = { appKey: apiKey, sdkKey: apiKey, mn: meetingNumber, role, iat, exp, tokenExp: exp };
  const signature = jwt.sign(payload, apiSecret, { algorithm: 'HS256' });
  console.log('Generated signature for meeting:', meetingNumber, 'role:', role);
  return signature;
}

// Create a new meeting
zoomRouter.post('/api/zoom/create-meeting', UserMw, async (req, res) => {
  try {
    const token = await getOrRefreshAccessToken();
    const response = await axios.post(
      `${ZOOM_API_BASE_URL}/users/me/meetings`,
      {
        topic: req.body.topic || 'New Meeting',
        type: 2, // Scheduled meeting
        start_time: req.body.start_time || new Date().toISOString(),
        duration: req.body.duration || 60,
        timezone: req.body.timezone || 'UTC',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          mute_upon_entry: false,
          waiting_room: false,
          auto_recording: 'none',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.status(200).json({
      success: true,
      data: {
        id: response.data.id,
        join_url: response.data.join_url,
        start_url: response.data.start_url,
        password: response.data.password,
        topic: response.data.topic,
        start_time: response.data.start_time,
        duration: response.data.duration,
      },
    });
  } catch (error) {
    console.error('Error creating meeting:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create Zoom meeting',
    });
  }
});

// Get meeting details
zoomRouter.get('/meetings/:meetingId', UserMw, async (req, res) => {
  try {
    const token = await getOrRefreshAccessToken();
    const response = await axios.get(
      `${ZOOM_API_BASE_URL}/meetings/${req.params.meetingId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Error fetching meeting:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch meeting details',
    });
  }
});

// Delete a meeting
zoomRouter.delete('/meetings/:meetingId', UserMw, async (req, res) => {
  try {
    const token = await getOrRefreshAccessToken();
    await axios.delete(
      `${ZOOM_API_BASE_URL}/meetings/${req.params.meetingId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.status(200).json({
      success: true,
      message: 'Meeting deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting meeting:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete meeting',
    });
  }
});

// Generate meeting signature for Zoom Web SDK
zoomRouter.post('/api/user/get-meeting-signature/:meetingId', UserMw, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const role = 1; // 1 for host, 0 for participant (adjust based on user role)
    const signature = generateSignature(ZOOM_API_KEY, ZOOM_API_SECRET, meetingId, role);

    res.status(200).json({
      success: true,
      data: {
        signature: signature,
      },
    });
  } catch (error) {
    console.error('Error generating signature:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate meeting signature',
    });
  }
});

module.exports = zoomRouter;