const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 8686;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    const db = client.db("sportnestDB");

    const sportCollection = db.collection("sports");
    const bookingCollection = db.collection("bookings");


    app.get("/sports", async (req, res) => {
      const cursor = sportCollection.find();
      const result = await cursor.toArray();

      res.send(result);
    });



    app.get("/sports/:facilityId", async (req, res) => {
      const { facilityId } = req.params;

      const query = {
        _id: new ObjectId(facilityId),
      };

      const result = await sportCollection.findOne(query);

      res.send(result);
    });



    app.post("/bookings", async (req, res) => {
      const bookingData = req.body;

      const result = await bookingCollection.insertOne(bookingData);

      res.send(result);
    });


    
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
