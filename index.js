const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 8686;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

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

    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.PUBLIC_URI}/api/auth/jwks`),
    );

    const verifyToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }

      const token = authHeader.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }

      try {
        const { payload } = await jwtVerify(token, JWKS);

        

        req.user = payload;

        next();
      } catch (error) {
       

        return res.status(403).json({
          message: "Forbidden",
        });
      }
    };

    app.get("/sports", async (req, res) => {
      const { search, type } = req.query;

      const query = {};

      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      if (type && type !== "All Sports") {
        const typesArray = type.split(",");
        query.facility_type = { $in: typesArray };
      }

      const cursor = sportCollection.find(query);
      const result = await cursor.toArray();

      res.send(result);
    });

    app.get("/sports/:facilityId", verifyToken, async (req, res) => {
      const { facilityId } = req.params;

      const query = {
        _id: new ObjectId(facilityId),
      };

      const result = await sportCollection.findOne(query);

      res.send(result);
    });

    app.post("/sports", async (req, res) => {
      const facilityData = req.body;
      const result = await sportCollection.insertOne(facilityData);
      res.send(result);
    });

    app.get("/bookings/:user_id", verifyToken, async (req, res) => {
      const { user_id } = req.params;

      if (req.user.id !== user_id) {
        return res.status(403).json({
          message: "Forbidden",
        });
      }

      const result = await bookingCollection.find({ user_id }).toArray();

      res.send(result);
    });

    app.post("/bookings", verifyToken, async (req, res) => {
      const bookingData = req.body;

      const result = await bookingCollection.insertOne(bookingData);

      res.send(result);
    });

    app.delete("/bookings/:booking_id", verifyToken, async (req, res) => {
      const { booking_id } = req.params;

      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(booking_id),
        user_id: req.user.id,
      });

      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } finally {
  }
}

run().catch(console.dir);
