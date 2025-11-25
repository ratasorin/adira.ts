import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User";
import Category from "./models/Category";
import Product from "./models/Product";
import Order from "./models/Order";

// Load environment variables from .dev.env file
dotenv.config({ path: '.dev.env' });

const MONGODB_URI = process.env.MONGO_URI || "mongodb://localhost:27017/demo";

interface SeedData {
  users: any[];
  categories: any[];
  products: any[];
  orders: any[];
}

const generateSeedData = (): SeedData => {
  // Generate Users
  const users = [
    {
      name: "John Smith",
      email: "john.smith@email.com",
      createdAt: new Date("2023-01-15"),
    },
    {
      name: "Sarah Johnson",
      email: "sarah.johnson@email.com",
      createdAt: new Date("2023-02-20"),
    },
    {
      name: "Mike Wilson",
      email: "mike.wilson@email.com",
      createdAt: new Date("2023-03-10"),
    },
    {
      name: "Emily Davis",
      email: "emily.davis@email.com",
      createdAt: new Date("2023-04-05"),
    },
    {
      name: "David Brown",
      email: "david.brown@email.com",
      createdAt: new Date("2023-05-12"),
    },
    {
      name: "Lisa Garcia",
      email: "lisa.garcia@email.com",
      createdAt: new Date("2023-06-18"),
    },
    {
      name: "Robert Miller",
      email: "robert.miller@email.com",
      createdAt: new Date("2023-07-22"),
    },
    {
      name: "Jennifer Taylor",
      email: "jennifer.taylor@email.com",
      createdAt: new Date("2023-08-30"),
    },
  ];

  // Generate Categories (Hierarchical structure)
  const categories = [
    // Electronics
    {
      name: "Electronics",
      description: "Electronic devices and gadgets",
      slug: "electronics",
      isActive: true,
      createdAt: new Date("2023-01-01"),
    },
    {
      name: "Computers",
      description: "Desktop and laptop computers",
      slug: "electronics/computers",
      isActive: true,
      createdAt: new Date("2023-01-02"),
    },
    {
      name: "Laptops",
      description: "Portable computers and notebooks",
      slug: "electronics/computers/laptops",
      isActive: true,
      createdAt: new Date("2023-01-03"),
    },
    {
      name: "Desktops",
      description: "Desktop computers and workstations",
      slug: "electronics/computers/desktops",
      isActive: true,
      createdAt: new Date("2023-01-04"),
    },
    {
      name: "Mobile",
      description: "Mobile phones and tablets",
      slug: "electronics/mobile",
      isActive: true,
      createdAt: new Date("2023-01-05"),
    },
    {
      name: "Smartphones",
      description: "Advanced mobile phones",
      slug: "electronics/mobile/smartphones",
      isActive: true,
      createdAt: new Date("2023-01-06"),
    },
    {
      name: "Tablets",
      description: "Tablet computers and iPads",
      slug: "electronics/mobile/tablets",
      isActive: true,
      createdAt: new Date("2023-01-07"),
    },
    {
      name: "Audio",
      description: "Headphones, speakers, and audio equipment",
      slug: "electronics/audio",
      isActive: true,
      createdAt: new Date("2023-01-08"),
    },
    {
      name: "Headphones",
      description: "Wired and wireless headphones",
      slug: "electronics/audio/headphones",
      isActive: true,
      createdAt: new Date("2023-01-09"),
    },
    {
      name: "Speakers",
      description: "Bluetooth and smart speakers",
      slug: "electronics/audio/speakers",
      isActive: true,
      createdAt: new Date("2023-01-10"),
    },

    // Fashion
    {
      name: "Fashion",
      description: "Clothing and accessories",
      slug: "fashion",
      isActive: true,
      createdAt: new Date("2023-01-11"),
    },
    {
      name: "Men's Clothing",
      description: "Clothing for men",
      slug: "fashion/mens",
      isActive: true,
      createdAt: new Date("2023-01-12"),
    },
    {
      name: "Women's Clothing",
      description: "Clothing for women",
      slug: "fashion/womens",
      isActive: true,
      createdAt: new Date("2023-01-13"),
    },
    {
      name: "Shoes",
      description: "Footwear for all occasions",
      slug: "fashion/shoes",
      isActive: true,
      createdAt: new Date("2023-01-14"),
    },
    {
      name: "Accessories",
      description: "Fashion accessories and jewelry",
      slug: "fashion/accessories",
      isActive: true,
      createdAt: new Date("2023-01-15"),
    },

    // Home & Garden
    {
      name: "Home & Garden",
      description: "Home improvement and garden supplies",
      slug: "home-garden",
      isActive: true,
      createdAt: new Date("2023-01-16"),
    },
    {
      name: "Furniture",
      description: "Home and office furniture",
      slug: "home-garden/furniture",
      isActive: true,
      createdAt: new Date("2023-01-17"),
    },
    {
      name: "Kitchen",
      description: "Kitchen appliances and tools",
      slug: "home-garden/kitchen",
      isActive: true,
      createdAt: new Date("2023-01-18"),
    },
    {
      name: "Garden",
      description: "Garden tools and plants",
      slug: "home-garden/garden",
      isActive: true,
      createdAt: new Date("2023-01-19"),
    },

    // Seasonal/Inactive Categories
    {
      name: "Halloween Costumes",
      description: "Spooky costumes for Halloween",
      slug: "seasonal/halloween-costumes",
      isActive: false, // Inactive - not Halloween season
      createdAt: new Date("2023-01-20"),
    },
    {
      name: "Christmas Decorations",
      description: "Holiday decorations and ornaments",
      slug: "seasonal/christmas-decorations",
      isActive: false, // Inactive - not Christmas season
      createdAt: new Date("2023-01-21"),
    },
  ];

  // Generate Products
  const products = [
    // Electronics - Laptops
    {
      name: "MacBook Pro 16-inch",
      description: "Apple MacBook Pro with M2 chip, 16GB RAM, 512GB SSD",
      price: 2499.99,
      stock: 15,
      isActive: true,
      createdAt: new Date("2023-02-01"),
    },
    {
      name: "Dell XPS 13",
      description: "Dell XPS 13 laptop with Intel i7, 16GB RAM, 1TB SSD",
      price: 1899.99,
      stock: 8,
      isActive: true,
      createdAt: new Date("2023-02-02"),
    },
    {
      name: "HP Spectre x360",
      description: "HP Spectre x360 convertible laptop with Intel i5",
      price: 1299.99,
      stock: 12,
      isActive: true,
      createdAt: new Date("2023-02-03"),
    },
    {
      name: "Lenovo ThinkPad X1 Carbon",
      description: "Business laptop with Intel i7, 16GB RAM, 512GB SSD",
      price: 1699.99,
      stock: 6,
      isActive: true,
      createdAt: new Date("2023-02-04"),
    },
    {
      name: "ASUS ROG Gaming Laptop",
      description: "Gaming laptop with RTX 4070, Intel i9, 32GB RAM",
      price: 2799.99,
      stock: 4,
      isActive: true,
      createdAt: new Date("2023-02-05"),
    },

    // Electronics - Desktops
    {
      name: "iMac 24-inch",
      description: "Apple iMac with M1 chip, 8GB RAM, 256GB SSD",
      price: 1299.99,
      stock: 10,
      isActive: true,
      createdAt: new Date("2023-02-06"),
    },
    {
      name: "Dell OptiPlex 7000",
      description: "Business desktop with Intel i7, 16GB RAM, 512GB SSD",
      price: 899.99,
      stock: 20,
      isActive: true,
      createdAt: new Date("2023-02-07"),
    },
    {
      name: "HP Pavilion Desktop",
      description: "Home desktop with AMD Ryzen 7, 16GB RAM, 1TB HDD",
      price: 699.99,
      stock: 15,
      isActive: true,
      createdAt: new Date("2023-02-08"),
    },

    // Electronics - Smartphones
    {
      name: "iPhone 15 Pro",
      description: "Apple iPhone 15 Pro with 128GB storage",
      price: 999.99,
      stock: 25,
      isActive: true,
      createdAt: new Date("2023-02-09"),
    },
    {
      name: "Samsung Galaxy S24",
      description: "Samsung Galaxy S24 with 256GB storage",
      price: 899.99,
      stock: 30,
      isActive: true,
      createdAt: new Date("2023-02-10"),
    },
    {
      name: "Google Pixel 8",
      description: "Google Pixel 8 with 128GB storage",
      price: 699.99,
      stock: 18,
      isActive: true,
      createdAt: new Date("2023-02-11"),
    },
    {
      name: "OnePlus 12",
      description: "OnePlus 12 with 256GB storage",
      price: 799.99,
      stock: 12,
      isActive: true,
      createdAt: new Date("2023-02-12"),
    },

    // Electronics - Tablets
    {
      name: "iPad Pro 12.9-inch",
      description: "Apple iPad Pro with M2 chip, 128GB storage",
      price: 1099.99,
      stock: 8,
      isActive: true,
      createdAt: new Date("2023-02-13"),
    },
    {
      name: "Samsung Galaxy Tab S9",
      description: "Samsung Galaxy Tab S9 with 256GB storage",
      price: 899.99,
      stock: 12,
      isActive: true,
      createdAt: new Date("2023-02-14"),
    },
    {
      name: "Microsoft Surface Pro 9",
      description: "Microsoft Surface Pro 9 with Intel i7, 256GB",
      price: 1299.99,
      stock: 6,
      isActive: true,
      createdAt: new Date("2023-02-15"),
    },

    // Electronics - Headphones
    {
      name: "Sony WH-1000XM5",
      description: "Sony noise-canceling wireless headphones",
      price: 399.99,
      stock: 20,
      isActive: true,
      createdAt: new Date("2023-02-16"),
    },
    {
      name: "Bose QuietComfort 45",
      description: "Bose noise-canceling headphones",
      price: 329.99,
      stock: 15,
      isActive: true,
      createdAt: new Date("2023-02-17"),
    },
    {
      name: "AirPods Pro 2nd Gen",
      description: "Apple AirPods Pro with active noise cancellation",
      price: 249.99,
      stock: 35,
      isActive: true,
      createdAt: new Date("2023-02-18"),
    },
    {
      name: "JBL Live 660NC",
      description: "JBL wireless headphones with noise cancellation",
      price: 199.99,
      stock: 18,
      isActive: true,
      createdAt: new Date("2023-02-19"),
    },

    // Electronics - Speakers
    {
      name: "Amazon Echo Dot 5th Gen",
      description: "Smart speaker with Alexa",
      price: 49.99,
      stock: 50,
      isActive: true,
      createdAt: new Date("2023-02-20"),
    },
    {
      name: "Google Nest Audio",
      description: "Smart speaker with Google Assistant",
      price: 99.99,
      stock: 30,
      isActive: true,
      createdAt: new Date("2023-02-21"),
    },
    {
      name: "JBL Charge 5",
      description: "Portable Bluetooth speaker with 20h battery",
      price: 179.99,
      stock: 25,
      isActive: true,
      createdAt: new Date("2023-02-22"),
    },
    {
      name: "Bose SoundLink Flex",
      description: "Portable Bluetooth speaker with waterproof design",
      price: 149.99,
      stock: 20,
      isActive: true,
      createdAt: new Date("2023-02-23"),
    },

    // Fashion - Men's Clothing
    {
      name: "Classic White Dress Shirt",
      description: "Men's cotton dress shirt, slim fit",
      price: 79.99,
      stock: 40,
      isActive: true,
      createdAt: new Date("2023-02-24"),
    },
    {
      name: "Men's Dark Jeans",
      description: "Slim fit dark wash jeans",
      price: 89.99,
      stock: 35,
      isActive: true,
      createdAt: new Date("2023-02-25"),
    },
    {
      name: "Men's Wool Sweater",
      description: "Merino wool crew neck sweater",
      price: 129.99,
      stock: 20,
      isActive: true,
      createdAt: new Date("2023-02-26"),
    },

    // Fashion - Women's Clothing
    {
      name: "Women's Summer Dress",
      description: "Floral print midi dress",
      price: 69.99,
      stock: 30,
      isActive: true,
      createdAt: new Date("2023-02-27"),
    },
    {
      name: "Women's Blazer",
      description: "Professional blazer for work",
      price: 149.99,
      stock: 25,
      isActive: true,
      createdAt: new Date("2023-02-28"),
    },
    {
      name: "Women's Yoga Leggings",
      description: "High-waisted yoga leggings",
      price: 39.99,
      stock: 60,
      isActive: true,
      createdAt: new Date("2023-03-01"),
    },

    // Fashion - Shoes
    {
      name: "Men's Dress Shoes",
      description: "Leather Oxford dress shoes",
      price: 159.99,
      stock: 20,
      isActive: true,
      createdAt: new Date("2023-03-02"),
    },
    {
      name: "Women's Heels",
      description: "Classic black high heels",
      price: 99.99,
      stock: 25,
      isActive: true,
      createdAt: new Date("2023-03-03"),
    },
    {
      name: "Running Shoes",
      description: "Athletic running shoes for men and women",
      price: 129.99,
      stock: 40,
      isActive: true,
      createdAt: new Date("2023-03-04"),
    },

    // Fashion - Accessories
    {
      name: "Leather Wallet",
      description: "Genuine leather bifold wallet",
      price: 49.99,
      stock: 30,
      isActive: true,
      createdAt: new Date("2023-03-05"),
    },
    {
      name: "Women's Handbag",
      description: "Designer leather handbag",
      price: 199.99,
      stock: 15,
      isActive: true,
      createdAt: new Date("2023-03-06"),
    },
    {
      name: "Sunglasses",
      description: "UV protection sunglasses",
      price: 79.99,
      stock: 35,
      isActive: true,
      createdAt: new Date("2023-03-07"),
    },

    // Home & Garden - Furniture
    {
      name: "Office Chair",
      description: "Ergonomic office chair with lumbar support",
      price: 299.99,
      stock: 15,
      isActive: true,
      createdAt: new Date("2023-03-08"),
    },
    {
      name: "Dining Table",
      description: "Wooden dining table for 6 people",
      price: 599.99,
      stock: 8,
      isActive: true,
      createdAt: new Date("2023-03-09"),
    },
    {
      name: "Bookshelf",
      description: "5-tier wooden bookshelf",
      price: 149.99,
      stock: 20,
      isActive: true,
      createdAt: new Date("2023-03-10"),
    },

    // Home & Garden - Kitchen
    {
      name: "Coffee Maker",
      description: "Programmable coffee maker with thermal carafe",
      price: 89.99,
      stock: 25,
      isActive: true,
      createdAt: new Date("2023-03-11"),
    },
    {
      name: "Blender",
      description: "High-speed blender for smoothies",
      price: 129.99,
      stock: 18,
      isActive: true,
      createdAt: new Date("2023-03-12"),
    },
    {
      name: "Air Fryer",
      description: "Digital air fryer with multiple presets",
      price: 99.99,
      stock: 30,
      isActive: true,
      createdAt: new Date("2023-03-13"),
    },

    // Home & Garden - Garden
    {
      name: "Lawn Mower",
      description: "Electric lawn mower with 16-inch cutting width",
      price: 199.99,
      stock: 12,
      isActive: true,
      createdAt: new Date("2023-03-14"),
    },
    {
      name: "Garden Tools Set",
      description: "Complete garden tool set with carrying case",
      price: 79.99,
      stock: 25,
      isActive: true,
      createdAt: new Date("2023-03-15"),
    },
    {
      name: "Plant Pot Set",
      description: "Ceramic plant pots with drainage",
      price: 39.99,
      stock: 40,
      isActive: true,
      createdAt: new Date("2023-03-16"),
    },
  ];

  // Generate Orders
  const orders = [
    {
      status: "delivered",
      paymentStatus: "completed",
      paymentMethod: "credit_card",
      shippingAddress: {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        country: "USA",
      },
      createdAt: new Date("2023-03-15"),
    },
    {
      status: "processing",
      paymentStatus: "completed",
      paymentMethod: "paypal",
      shippingAddress: {
        street: "456 Oak Ave",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90210",
        country: "USA",
      },
      createdAt: new Date("2023-03-20"),
    },
    {
      status: "shipped",
      paymentStatus: "completed",
      paymentMethod: "credit_card",
      shippingAddress: {
        street: "789 Pine St",
        city: "Chicago",
        state: "IL",
        zipCode: "60601",
        country: "USA",
      },
      createdAt: new Date("2023-03-25"),
    },
    {
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: "credit_card",
      shippingAddress: {
        street: "321 Elm St",
        city: "Houston",
        state: "TX",
        zipCode: "77001",
        country: "USA",
      },
      createdAt: new Date("2023-03-28"),
    },
    {
      status: "delivered",
      paymentStatus: "completed",
      paymentMethod: "debit_card",
      shippingAddress: {
        street: "654 Maple Dr",
        city: "Phoenix",
        state: "AZ",
        zipCode: "85001",
        country: "USA",
      },
      createdAt: new Date("2023-04-01"),
    },
    {
      status: "cancelled",
      paymentStatus: "failed",
      paymentMethod: "credit_card",
      shippingAddress: {
        street: "987 Cedar Ln",
        city: "Philadelphia",
        state: "PA",
        zipCode: "19101",
        country: "USA",
      },
      createdAt: new Date("2023-04-05"),
    },
    {
      status: "delivered",
      paymentStatus: "completed",
      paymentMethod: "paypal",
      shippingAddress: {
        street: "147 Birch Way",
        city: "San Antonio",
        state: "TX",
        zipCode: "78201",
        country: "USA",
      },
      createdAt: new Date("2023-04-10"),
    },
    {
      status: "processing",
      paymentStatus: "completed",
      paymentMethod: "credit_card",
      shippingAddress: {
        street: "258 Spruce Ct",
        city: "San Diego",
        state: "CA",
        zipCode: "92101",
        country: "USA",
      },
      createdAt: new Date("2023-04-15"),
    },
    {
      status: "shipped",
      paymentStatus: "completed",
      paymentMethod: "debit_card",
      shippingAddress: {
        street: "369 Willow St",
        city: "Dallas",
        state: "TX",
        zipCode: "75201",
        country: "USA",
      },
      createdAt: new Date("2023-04-20"),
    },
    {
      status: "delivered",
      paymentStatus: "completed",
      paymentMethod: "credit_card",
      shippingAddress: {
        street: "741 Ash Blvd",
        city: "San Jose",
        state: "CA",
        zipCode: "95101",
        country: "USA",
      },
      createdAt: new Date("2023-04-25"),
    },
  ];

  return { users, categories, products, orders };
};

const connectDB = async (): Promise<void> => {
  try {
    console.log(`🔗 Connecting to MongoDB: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

const clearDatabase = async (): Promise<void> => {
  try {
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    console.log("🗑️  Cleared existing data");
  } catch (error) {
    console.error("❌ Error clearing database:", error);
    throw error;
  }
};

const seedDatabase = async (): Promise<void> => {
  try {
    console.log("🌱 Starting database seeding...");

    const { users, categories, products, orders } = generateSeedData();

    // Create Users
    console.log("👥 Creating users...");
    const createdUsers = await User.insertMany(users);
    console.log(`✅ Created ${createdUsers.length} users`);

    // Create Categories (need to handle parent relationships)
    console.log("📁 Creating categories...");

    // Add createdBy field to all categories before insertion
    const categoriesWithCreatedBy = categories.map(category => ({
      ...category,
      createdBy: createdUsers[0]._id // Assign all categories to first user
    }));

    const createdCategories = await Category.insertMany(categoriesWithCreatedBy);

    // Update parentCategory references
    const categoryMap = new Map<string, mongoose.Types.ObjectId>();
    createdCategories.forEach((cat, index) => {
      categoryMap.set(categories[index].slug, cat._id);
    });

    // Update parent categories
    for (let i = 0; i < createdCategories.length; i++) {
      const category = createdCategories[i];
      const originalCategory = categories[i];

      if (originalCategory.slug.includes("/")) {
        const parentSlug = originalCategory.slug.substring(
          0,
          originalCategory.slug.lastIndexOf("/"),
        );
        const parentId = categoryMap.get(parentSlug);

        if (parentId) {
          await Category.findByIdAndUpdate(category._id, {
            parentCategory: parentId
          });
        }
      }
    }
    console.log(`✅ Created ${createdCategories.length} categories`);

    // Create Products
    console.log("📦 Creating products...");
    const productCategories = [
      // Laptops
      "electronics/computers/laptops",
      "electronics/computers/laptops",
      "electronics/computers/laptops",
      "electronics/computers/laptops",
      "electronics/computers/laptops",
      // Desktops
      "electronics/computers/desktops",
      "electronics/computers/desktops",
      "electronics/computers/desktops",
      // Smartphones
      "electronics/mobile/smartphones",
      "electronics/mobile/smartphones",
      "electronics/mobile/smartphones",
      "electronics/mobile/smartphones",
      // Tablets
      "electronics/mobile/tablets",
      "electronics/mobile/tablets",
      "electronics/mobile/tablets",
      // Headphones
      "electronics/audio/headphones",
      "electronics/audio/headphones",
      "electronics/audio/headphones",
      "electronics/audio/headphones",
      // Speakers
      "electronics/audio/speakers",
      "electronics/audio/speakers",
      "electronics/audio/speakers",
      "electronics/audio/speakers",
      // Men's Clothing
      "fashion/mens",
      "fashion/mens",
      "fashion/mens",
      // Women's Clothing
      "fashion/womens",
      "fashion/womens",
      "fashion/womens",
      // Shoes
      "fashion/shoes",
      "fashion/shoes",
      "fashion/shoes",
      // Accessories
      "fashion/accessories",
      "fashion/accessories",
      "fashion/accessories",
      // Furniture
      "home-garden/furniture",
      "home-garden/furniture",
      "home-garden/furniture",
      // Kitchen
      "home-garden/kitchen",
      "home-garden/kitchen",
      "home-garden/kitchen",
      // Garden
      "home-garden/garden",
      "home-garden/garden",
      "home-garden/garden",
    ];

    const createdProducts = await Promise.all(
      products.map(async (product, index) => {
        const categorySlug = productCategories[index];
        const categoryId = categoryMap.get(categorySlug);
        const owner = createdUsers[index % createdUsers.length]._id;

        return await Product.create({
          ...product,
          category: categoryId,
          owner,
        });
      }),
    );
    console.log(`✅ Created ${createdProducts.length} products`);

    // Create Orders with random products
    console.log("🛒 Creating orders...");
    const createdOrders = await Promise.all(
      orders.map(async (order, index) => {
        const user = createdUsers[index % createdUsers.length];
        const orderProducts = [];
        const numProducts = Math.floor(Math.random() * 3) + 1; // 1-3 products per order

        for (let i = 0; i < numProducts; i++) {
          const product =
            createdProducts[Math.floor(Math.random() * createdProducts.length)];
          const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity
          orderProducts.push({
            product: product._id,
            quantity,
            priceAtPurchase: product.price,
          });
        }

        const totalAmount = orderProducts.reduce(
          (sum, item) => sum + item.priceAtPurchase * item.quantity,
          0,
        );

        return await Order.create({
          ...order,
          user: user._id,
          products: orderProducts,
          totalAmount,
        });
      }),
    );
    console.log(`✅ Created ${createdOrders.length} orders`);

    // Update users with their orders
    console.log("🔗 Linking orders to users...");
    for (let i = 0; i < createdOrders.length; i++) {
      const order = createdOrders[i];
      const userIndex = i % createdUsers.length;
      await User.findByIdAndUpdate(createdUsers[userIndex]._id, {
        $push: { orders: order._id },
      });
    }

    console.log("🎉 Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   👥 Users: ${createdUsers.length}`);
    console.log(`   📁 Categories: ${createdCategories.length}`);
    console.log(`   📦 Products: ${createdProducts.length}`);
    console.log(`   🛒 Orders: ${createdOrders.length}`);
    console.log("\n🔗 Connection string: mongodb://localhost:27017/demo");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
};

const main = async (): Promise<void> => {
  try {
    console.log(`🔧 Using MongoDB URI: ${MONGODB_URI}`);
    await connectDB();
    await clearDatabase();
    await seedDatabase();

    console.log("\n✨ Seed script completed successfully!");
    console.log(
      "🚀 You can now start your backend server and test the API endpoints.",
    );
  } catch (error) {
    console.error("💥 Seed script failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Run the seed script
if (require.main === module) {
  main();
}

export default main;
