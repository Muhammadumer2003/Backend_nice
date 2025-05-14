const mongoose=require('mongoose');

const ConnectionRequestSchema=new mongoose.Schema({
    sender:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    reciever:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    status:{
        type:String,
        enum:
            ["interested","accepted","rejected","notinterested"]
    
    }
},{
    timestamps:true
});
const ConnectionRequest =mongoose.model('ConnectionRequest',ConnectionRequestSchema);

module.exports=ConnectionRequest;