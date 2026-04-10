import clientPromise from "@/lib/db/mongodb";

const USERNAME_REGEX = /^[a-z0-9-]{1,32}$/;

async function getCollection() {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  return db.collection("users");
}

export async function getUserByEmail(email) {
  const collection = await getCollection();
  return collection.findOne({ email: email.toLowerCase() });
}

export async function getUserById(id) {
  const collection = await getCollection();
  const { ObjectId } = await import("mongodb");
  return collection.findOne({ _id: new ObjectId(id) });
}

export async function ensureUsername(userId, email) {
  const collection = await getCollection();
  const { ObjectId } = await import("mongodb");
  const user = await collection.findOne({ _id: new ObjectId(userId) });

  if (user?.username) {
    return user.username;
  }

  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "user";

  let username = base;
  let index = 2;

  while (await collection.findOne({ username })) {
    const suffix = `-${index}`;
    username = base.slice(0, 32 - suffix.length) + suffix;
    index += 1;
  }

  await collection.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { username } },
  );

  return username;
}

export async function updateUsername(userId, username) {
  if (!USERNAME_REGEX.test(username)) {
    throw Object.assign(new Error("Invalid username format"), {
      code: "INVALID_USERNAME",
    });
  }

  const collection = await getCollection();
  const { ObjectId } = await import("mongodb");
  const existing = await collection.findOne({
    username,
    _id: { $ne: new ObjectId(userId) },
  });

  if (existing) {
    throw Object.assign(new Error("Username already taken"), {
      code: "USERNAME_TAKEN",
    });
  }

  await collection.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { username } },
  );

  return username;
}
