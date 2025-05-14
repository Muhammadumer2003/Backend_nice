// const { Server } = require("socket.io");


// const initializedsocket= (server)=>{

//     const io=new Server(server,{
//         cors: {
//             origin: "http://localhost:3000",
//             methods: ["GET", "POST"],
//             credentials: true
//         }
//     });

//     io.on("connection",(socket)=>{
//         console.log("A user connected");

//         socket.on("joinchat",({userId,targetUserId})=>{

//             console.log("userId: " + userId)
//             console.log("targetUserId: " + targetUserId)
//             const roomId=[userId,targetUserId].sort().join("_");
           
//             socket.join(roomId)
//         });
//         socket.on("sendMessage",({firstName,
//             userId,
//             targetUserId,
//             text})=>{
//                 const roomId=[userId,targetUserId].sort().join("_");
//                 console.log(firstName+ ": " + text)
//                 io.to(roomId).emit("ReceivedMessages",{firstName,text})
//             });
//         socket.on("disconnect",()=>{
//             console.log("User disconnected");
//         });

//     })

//     return io;
// }

// module.exports=initializedsocket;







const { Server } = require("socket.io");
const Chat = require("../models/Chat.model"); // Assuming this is the path to your chat model

const initializedSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    socket.on("joinChat", async ({ userId, targetUserId }) => {
      if (!userId || !targetUserId) {
        console.log("Invalid user or target user ID");
        return;
      }
      const roomId = [userId, targetUserId].sort().join("_");
      socket.join(roomId);
      console.log(`User ${userId} joined room ${roomId}`);

      // Load existing messages for the chat
      try {
        const chat = await Chat.findOne({
          participants: { $all: [userId, targetUserId] },
        }).populate("messages.sender", "fullname"); // Populate sender's name
        if (chat) {
          io.to(roomId).emit("loadMessages", chat.messages);
        } else {
          // Create new chat if it doesn't exist
          const newChat = new Chat({
            participants: [userId, targetUserId],
            messages: [],
          });
          await newChat.save();
        }
      } catch (error) {
        console.error("Error loading messages:", error);
      }
    });

    socket.on("sendMessage", async ({ firstName, userId, targetUserId, text }) => {
      if (!userId || !targetUserId || !text) {
        console.log("Missing required fields for sending message");
        return;
      }
      const roomId = [userId, targetUserId].sort().join("_");
      const messageData = {
        sender: userId,
        text: text,
      };

      try {
        const chat = await Chat.findOne({
          participants: { $all: [userId, targetUserId] },
        });
        if (chat) {
          chat.messages.push(messageData);
          await chat.save();
          io.to(roomId).emit("ReceivedMessages", {
            firstName,
            text,
            sender: userId,
            timestamp: new Date(),
          });
        } else {
          console.log("Chat not found");
        }
      } catch (error) {
        console.error("Error saving message:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected", socket.id);
    });
  });

  return io;
};

module.exports = initializedSocket;