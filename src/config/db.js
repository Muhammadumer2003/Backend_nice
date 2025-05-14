const mongoose = require('mongoose')
const dotenv=require('dotenv');



const dbConnect=async()=>{
    //connect to mongodb
    await mongoose.connect(`${process.env.MongoURI}`);

}

module.exports=dbConnect;