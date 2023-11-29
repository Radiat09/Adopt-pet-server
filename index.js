const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 9000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Middlewares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fgalepw.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    /************************ Collections ********************************/

    const petCollection = client.db("adoptPet").collection("pets");
    const userCollection = client.db("adoptPet").collection("users");
    const categoryCollection = client.db("adoptPet").collection("categories");
    const adoptCollection = client.db("adoptPet").collection("adoptions");
    const donationCollection = client.db("adoptPet").collection("donations");
    const donationCampaignCollection = client
      .db("adoptPet")
      .collection("donationCampaigns");

    /************************ JSON WEB TOKEN (JWT) ********************************/
    app.post("/api/v1/jwt", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.send({ token });
    });

    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers);
      if (!req.headers.authorization) {
        return res.status(404).send({ message: "Permission token not Found" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    /************************ Get Methods ********************************/
    // get users role
    app.get("/api/v1/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params?.email;
      // console.log(email, req.decoded?.email);
      if (email !== req.decoded?.email) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      // console.log(admin);
      res.send({ admin });
    });

    // Get all user
    app.get("/api/v1/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    //Get single user
    app.get("/api/v1/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const banned = user?.banned;
      res.send({ banned });
    });

    // Get all pet data with query
    app.get("/api/v1/pets", async (req, res) => {
      const query1 = req.query.query1;
      const query2 = req.query.query2;
      const query3 = req.query.query3;
      const page = parseInt(req.query?.page);
      const limit = parseInt(req.query?.limit);
      let query = {};
      if (query1 && query2) {
        query = {
          name: query1,
          category: query2,
        };
      }
      if (query1) {
        query = {
          name: query1,
        };
      }
      if (query2) {
        query = { category: query2 };
      }
      if (query3) {
        query = { email: query3 };
      }
      // console.log(query);
      const result = await petCollection
        .find(query)
        .skip(page * limit)
        .limit(limit)
        .toArray();
      res.send(result);
    });
    // Get single pet data
    app.get("/api/v1/pets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petCollection.findOne(query);
      res.send(result);
    });

    // Get all the categories
    app.get("/api/v1/categories", async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.send(result);
    });

    // Get all donation campaigns data api
    app.get("/api/v1/donationCampaigns", async (req, res) => {
      const result = await donationCampaignCollection
        .find()
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // get filtered donation campaigns
    app.get("/api/v1/myCampaigns/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
      };
      const result = await donationCampaignCollection.find(query).toArray();
      res.send(result);
    });

    // Get single donation campaign data api
    app.get("/api/v1/donationCampaigns/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const result = await donationCampaignCollection.findOne(query);
      res.send(result);
    });

    // get counts
    app.get("/api/v1/getCounts/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
      };
      const petCount = await petCollection.countDocuments(query);
      res.send({ petCount });
    });

    // get all my donations
    app.get("/api/v1/donations/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const query = { email: email };
      const result = await donationCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/api/v1/adoptions/:email", async (req, res) => {
      const query = { email: req.params.email };
      const result = await adoptCollection.find(query).toArray();
      res.send(result);
    });

    /************************ Put Methods ********************************/
    app.put("/api/v1/pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = {
        _id: new ObjectId(id),
      };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          email: data.email,
          name: data.name,
          age: data.age,
          category: data.category,
          location: data.location,
          shortDescription: data.shortDescription,
          longDescription: data.longDescription,
          image: data.image,
          date: data.date,
          adopted: data.adopted,
        },
      };
      const result = await petCollection.updateOne(filter, updatedDoc, options);
      // console.log("147", id, data);
      res.send(result);
    });

    app.put("/api/v1/donationCampaigns/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      // console.log(id, data);

      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const doc = {
        $set: {
          email: data.email,
          name: data.name,
          donationTarget: data.donationTarget,
          lastDate: data.lastDate,
          shortDescription: data.shortDescription,
          longDescription: data.longDescription,
          image: data.image,
          date: data.date,
          totalDonation: data.totalDonation,
          pause: data.pause,
        },
      };

      const result = await donationCampaignCollection.updateOne(
        filter,
        doc,
        options
      );
      res.send(result);
    });

    /************************ Patch Methods ********************************/
    app.patch("/api/v1/pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = {
        _id: new ObjectId(id),
      };
      const doc = {
        $set: {
          adopted: true,
        },
      };
      const result = await petCollection.updateOne(filter, doc);
      res.send(result);
    });

    app.patch(
      "/api/v1/donationCampaigns/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const { value } = req.body;
        const query = {
          _id: new ObjectId(id),
        };
        // console.log(value, id);
        const doc = {
          $set: {
            pause: value,
          },
        };
        const result = await donationCampaignCollection.updateOne(query, doc);
        res.send(result);
      }
    );

    app.patch("/api/v1/adoptions/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const doc = {
        $set: {
          status: status,
        },
      };
      // console.log(id, status);
      const result = await adoptCollection.updateOne(filter, doc);
      res.send(result);
    });

    app.patch(
      "/api/v1/users/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;

        if (!id) {
          return res.status("404").send({ message: "user not found" });
        }
        const filter = { _id: new ObjectId(id) };
        const doc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, doc);
        res.send(result);
      }
    );
    app.patch(
      "/api/v1/usersBan/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { value } = req.body;
        const filter = { _id: new ObjectId(id) };
        const doc = {
          $set: {
            banned: value,
          },
        };
        const result = await userCollection.updateOne(filter, doc);
        res.send(result);
      }
    );

    /************************ Post Methods ********************************/
    app.post("/api/v1/pets", verifyToken, async (req, res) => {
      const petData = req.body;
      // console.log(petData);
      const result = await petCollection.insertOne(petData);
      res.send(result);
    });

    // Create Adoption data api
    app.post("/api/v1/adoptions", verifyToken, async (req, res) => {
      const { adoptionData } = req.body;
      console.log(adoptionData);
      const result = await adoptCollection.insertOne(adoptionData);
      res.send(result);
    });

    // Payment Intent (Stripe)
    app.post("/api/v1/create-payment-intent", verifyToken, async (req, res) => {
      const { amount } = req.body;
      // console.log(price);
      const newAmount = parseInt(amount * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: newAmount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //store Donations in database
    app.post("/api/v1/donations", verifyToken, async (req, res) => {
      const donation = req.body;
      const donationResult = await donationCollection.insertOne(donation);
      const donor = {
        email: donation.email,
        name: donation.name,
        date: donation.date,
        amount: donation.amount,
      };
      const id = donation.campaignDetails._id;
      // console.log("donation info", donor, id);
      const query = { _id: new ObjectId(id) };
      const updatedDoc = { $push: { totalDonation: donor } };
      const updateResult = await donationCampaignCollection.updateOne(
        query,
        updatedDoc
      );
      // res.send(result);

      res.send({ donationResult, updateResult });
    });

    // Save User info in database
    app.post("/api/v1/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const isUserExits = await userCollection.findOne(query);
      if (isUserExits) {
        return res.send({ message: "Old user", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Create Donation campaign
    app.post("/api/v1/donationCampaigns", verifyToken, async (req, res) => {
      const data = req.body;
      // console.log("from 235", data);
      const result = await donationCampaignCollection.insertOne(data);
      res.send(result);
    });

    /************************ Delete Methods ********************************/
    app.delete("/api/v1/pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await petCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/api/v1/donations/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };

      const result = await donationCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/api/v1/adoptions/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await adoptCollection.deleteOne(query);
      res.send(result);
    });

    app.delete(
      "/api/v1/donationCampaigns/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await donationCampaignCollection.deleteOne(query);
        res.send(result);
      }
    );

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Adopt Pet is running");
});

app.listen(port, () => {
  console.log("Adopt Pet server is running on port: ", port);
});
