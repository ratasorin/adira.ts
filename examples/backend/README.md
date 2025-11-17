# Demo Backend with Mongoose for Adira Generator

This Express.js backend demonstrates the Adira generator with a Mongoose User model. Routes return typed responses using the User schema, including ObjectId fields (which the generator will process).

## Setup

1. From the root:
   ```
   npm run build --workspace=packages/cli
   npm run build --workspace=packages/generator
   ```
2. `cd examples/backend && npm install` (installs mongoose, express, etc.)

## Generating Types

Run `npm run generate-types` to parse `./src` and generate API types in `./types/`. The output will include User schema types for `/api/users` endpoints, with ObjectIdLike replacements.

## Running the Server

`npm run dev` starts the server on port 3000 (connects to local MongoDB at mongodb://localhost:27017/demo; start MongoDB if needed).

Test routes:

- GET `/api/users` - Returns mock User[] with \_id as ObjectId.
- POST `/api/users` - Creates mock User from {name, email} body.

The generator will detect the IUser types in handlers and generate corresponding API definitions.
