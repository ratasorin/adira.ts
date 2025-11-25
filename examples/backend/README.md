# Demo Backend with Mongoose for Adira Generator

This Express.js backend demonstrates the Adira generator with a complete e-commerce data model including Users, Categories, Products, and Orders. Routes return typed responses using Mongoose schemas, including ObjectId fields and relationships.

## Setup

1. **Install dependencies:**
   ```bash
   cd examples/backend
   npm install
   ```

2. **Configure environment:**
   The `.dev.env` file contains the MongoDB connection string:
   ```bash
   MONGO_URI=mongodb://localhost:27017/demo
   ```
   Modify this file if you need to connect to a different MongoDB instance.

3. **Start MongoDB:**
   Make sure MongoDB is running and accessible via the URI in `.dev.env`

4. **Seed the database with test data:**
   ```bash
   npm run seed
   ```
   This creates:
   - 8 users
   - 22 categories (hierarchical structure)
   - 50+ products across all categories
   - 10 orders with multiple products each

## Running the Server

```bash
npm run dev
```

Server starts on port 5000 and connects to MongoDB.

## API Endpoints

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Categories
- `GET /api/categories` - Get all categories (supports hierarchical include)
- `POST /api/categories` - Create category
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Products
- `GET /api/products` - Get all products (supports include category, owner)
- `POST /api/products` - Create product
- `PATCH /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders
- `GET /api/orders` - Get all orders (supports include user, products.product)
- `POST /api/orders` - Create order
- `PATCH /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

## Query Examples

### Filter products by price
```
GET /api/products?filters[price][$gt]=1000
```

### Get categories with parent hierarchy
```
GET /api/categories?include=parentCategory&limit=10
```

### Select specific fields
```
GET /api/products?select=name,price,category&limit=5
```

### Get active categories only
```
GET /api/categories?filters[isActive]=true
```

### Complex query with multiple parameters
```
GET /api/products?include=category,owner&filters[price][$lt]=500&select=name,price,category.name&sort=price:-1&limit=10
```

## Testing

Run the automated API test script:
```bash
./test-api.sh
```

This tests all endpoints and demonstrates various query parameters.

## Data Model

### Users
- Basic user information with email uniqueness
- References to Orders

### Categories
- Hierarchical structure (parentCategory)
- SEO-friendly slugs
- Active/inactive status for seasonal categories
- References to User (createdBy)

### Products
- Belong to Categories
- Owned by Users
- Stock management
- Price and description

### Orders
- Belong to Users
- Contain multiple Products with quantities
- Order status tracking
- Shipping and payment information

## Business Logic Examples

The seed data demonstrates:
- **Hierarchical categories**: Electronics → Computers → Laptops
- **Soft deletion**: All models support soft delete via `deletedAt` field
- **Active/inactive categories**: Seasonal categories like "Halloween Costumes" are inactive
- **Complex relationships**: Orders include multiple products, products belong to categories and users
- **Realistic data**: Actual product names, prices, and business scenarios

## Configuration

### Environment Variables

The application uses a `.dev.env` file for configuration. You can modify this file to connect to different MongoDB instances:

```bash
# Local MongoDB
MONGO_URI=mongodb://localhost:27017/demo

# MongoDB Atlas (cloud)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/demo

# MongoDB with authentication
MONGO_URI=mongodb://username:password@localhost:27017/demo
```

Both the main server (`npm run dev`) and the seed script (`npm run seed`) will use the `MONGO_URI` from your `.dev.env` file.
