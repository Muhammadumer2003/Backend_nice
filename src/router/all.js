const express=require('express');
const { UserMw } = require('../middlewares/auth');
const ConnectionRequest = require('../models/request.model');
const User = require('../models/user.model');
const allRouter=express.Router();

allRouter.get('/user/getPendingRequests',UserMw,async(req,res)=>{
    try{
        const loggedInuser=req.user;
        const pendingRequests = await ConnectionRequest.find({
            reciever: loggedInuser._id,
            status: "interested",
        }).populate('sender', 'firstName lastName');
        console.log(pendingRequests);
        if(!pendingRequests){
            throw new Error("Unable to fetch data");
        }

        res.status(201).json({
            message:"Got all requests",
            data:{
                pendingRequests
            }

        })


    }
    catch(error){
        res.status(500).send({message:error.message});
    }
})


//get all 

allRouter.get('/user/getallconnections',UserMw,async(req,res)=>{
    try{
        const loggedInUser=req.user;
        const connectionSearching= await ConnectionRequest.find({
            $or:[{sender:loggedInUser._id},
                {reciever:loggedInUser._id}
            ],
            status:"accepted"
        }).populate("sender reciever","firstName lastName age gender");

        if(!connectionSearching){
            throw new Error("Unable to fetch data");
        }

        const data= connectionSearching.map((row)=>{
            if(row.sender._id.toString()==loggedInUser._id.toString()){
                return row.reciever
                

            }
            else{
                return row.sender;
            }
        })

        res.send({
            message:"Got all connections",
           data:data
            
        })



    }
    catch(error){
        res.status(500).send({message:error.message});
    }
})


allRouter.get("/user/feed",UserMw,async(req,res)=>{
   try {
     const loggedInUser=req.user;
     const pageNo=parseInt(req.query.page)||1;
     let limit=parseInt(req.query.limit)||10;
     limit=limit>50?50:limit;
     const skip=(pageNo-1)*limit;


     


   

     const allRequests=await ConnectionRequest.find({
        $or:[{sender:loggedInUser._id},
                {reciever:loggedInUser._id}
            ],
        
     });

     const setRequests = new Set();
     allRequests.forEach((row) => {
        setRequests.add(row.sender.toString());
        setRequests.add(row.reciever.toString());
     });
    
     console.log(setRequests);


     const LegitUsers=await User.find({
        $and:[{_id:{$nin:Array.from(setRequests)}},
             {_id:{$ne:loggedInUser._id}}
         ]

        
     }).select("firstName lastName age gender").skip(skip).limit(limit)

     
     res.send({
         message:"Got all users",
         data:LegitUsers
     })
   } catch (error) {
     res.status(500).send({message:error.message});
    
   }
})


module.exports=allRouter;