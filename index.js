const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 8686;

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.PUBLIC_URI}/api/auth/jwks`)
);

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    const db = client.db("sportnestDB");

    const sportCollection = db.collection("sports");
    const bookingCollection = db.collection("bookings");

    const verifyToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
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
        const { payload } = await jwtVerify(token, JWKS, {
          issuer: process.env.PUBLIC_URI,
          audience: process.env.PUBLIC_URI,
        });

        req.user = payload;

        next();
      } catch (error) {
        console.error("JWT verification failed:", error.message);

        return res.status(403).json({
          message: "Forbidden",
        });
      }
    };

    app.get("/", (req, res) => {
      res.send("SportNest Server is Running");
    });

    

    app.get("/sports", async (req, res) => {
      try {
        const { search, type, email } = req.query;

        const query = {};

        if (email) {
          query.owner_email = email;
        }

        if (search) {
          query.name = {
            $regex: search,
            $options: "i",
          };
        }

        if (type && type !== "All Sports") {
          const typesArray = type.split(",");

          query.facility_type = {
            $in: typesArray,
          };
        }

        const result = await sportCollection.find(query).toArray();

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).json({
          message: "Failed to fetch facilities",
        });
      }
    });

    app.get("/sports/:facilityId", verifyToken, async (req, res) => {
      try {
        const { facilityId } = req.params;

        if (!ObjectId.isValid(facilityId)) {
          return res.status(400).json({
            message: "Invalid facility ID",
          });
        }

        const result = await sportCollection.findOne({
          _id: new ObjectId(facilityId),
        });

        if (!result) {
          return res.status(404).json({
            message: "Facility not found",
          });
        }

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).json({
          message: "Failed to fetch facility",
        });
      }
    });

    app.post("/sports", verifyToken, async (req, res) => {
      try {
        const facilityData = req.body;

        const result = await sportCollection.insertOne(facilityData);

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).json({
          message: "Failed to add facility",
        });
      }
    });

    app.put("/sports/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            message: "Invalid facility ID",
          });
        }

        const updatedData = req.body;

        const filter = {
          _id: new ObjectId(id),
        };

        const updateDoc = {
          $set: {
            name: updatedData.name,
            facility_type: updatedData.facility_type,
            image: updatedData.image,
            location: updatedData.location,
            price_per_hour: Number(updatedData.price_per_hour),
            capacity: Number(updatedData.capacity),
            available_slots: updatedData.available_slots,
            description: updatedData.description,
          },
        };

        const result = await sportCollection.updateOne(
          filter,
          updateDoc
        );

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).json({
          message: "Failed to update facility",
        });
      }
    });

    app.delete("/sports/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            message: "Invalid facility ID",
          });
        }

        const result = await sportCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).json({
          message: "Failed to delete facility",
        });
      }
    });

 
    app.get("/bookings/:user_id", verifyToken, async (req, res) => {
      try {
        const { user_id } = req.params;

        if (req.user.id !== user_id) {
          return res.status(403).json({
            message: "Forbidden",
          });
        }

        const result = await bookingCollection
          .find({ user_id })
          .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).json({
          message: "Failed to fetch bookings",
        });
      }
    });

    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const bookingData = req.body;

        if (bookingData.user_id !== req.user.id) {
          return res.status(403).json({
            message: "Forbidden",
          });
        }

        const result = await bookingCollection.insertOne(
          bookingData
        );

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).json({
          message: "Failed to create booking",
        });
      }
    });

    app.delete(
      "/bookings/:booking_id",
      verifyToken,
      async (req, res) => {
        try {
          const { booking_id } = req.params;

          if (!ObjectId.isValid(booking_id)) {
            return res.status(400).json({
              message: "Invalid booking ID",
            });
          }

          const result = await bookingCollection.deleteOne({
            _id: new ObjectId(booking_id),
            user_id: req.user.id,
          });

          res.send(result);
        } catch (error) {
          console.error(error);

          res.status(500).json({
            message: "Failed to cancel booking",
          });
        }
      }
    );

    console.log("SportNest server connected successfully");

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Server startup error:", error);
  }
}

run();