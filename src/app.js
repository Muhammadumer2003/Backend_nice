const express = require('express');
const dbConnect=require('./config/db');
const cookieParser = require('cookie-parser');
const cors=require('cors');
const dotenv=require('dotenv');
const http=require('http');




const app=express();


//global middlewares
app.use(cors({
    origin: 'http://localhost:3000', // allow requests from this origin
    credentials: true, // allow sending cookies over HTTP requests,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Include PATCH
  allowedHeaders: ['Content-Type', 'Authorization'], 
}))
app.use(express.json());
app.use(cookieParser());


//routers

const authRouter=require('./router/auth.js');
const profileRouter=require('./router/profile.js');
const requestRouter=require('./router/requests.js');
const allRouter=require('./router/all.js');
const initializedsocket = require('./utils/socket.js');
const chatRouter=require("./router/chat.js")
const Jobrouter=require("./router/job.js")
const Proposalrouter=require("./router/proposal.js")
const chatbotRouter=require("./router/chatbot.js")
const Reportrouter=require("./router/report.js")
const zoomRouter=require("./router/zoom.js")
app.use('/uploads', express.static('uploads')); // Serve uploaded files

//dotenv config
dotenv.config();

app.use('/',authRouter);
app.use('/',profileRouter);
app.use('/',requestRouter);
app.use('/',allRouter);
app.use("/",chatRouter);
app.use("/",Proposalrouter);
app.use("/",Jobrouter);
app.use("/",chatbotRouter);
app.use("/",Reportrouter);
app.use("/",zoomRouter);




const server=http.createServer(app);
const io = initializedsocket(server);









//db connection logic
dbConnect().then(()=>{
    console.log("Connected to db");
    server.listen(process.env.PORT || 8008,()=>{
        console.log("server is running on : ", process.env.PORT || 8008);
    }); 



}).catch((err)=>{
    console.error("Failed to connect to db",err);
    process.exit(1);  //exit the app with error code 1
 });
