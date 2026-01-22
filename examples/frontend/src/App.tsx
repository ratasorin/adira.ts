import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { api } from "./api";
import type { ErrorResponse } from "@examples/backend.types/src/types";

const isErrorResponse = <T,>(
  response: T | ErrorResponse,
): response is ErrorResponse => {
  return response && typeof (response as ErrorResponse).error === "string";
};

type CategoryResponse = {
  _id: string;
  name: string;
  description: string;
  slug: string;
  createdAt: Date;
};

const queryCategories = api("/categories", "GET");
function App() {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const response = await queryCategories({
        include: [] as const,
        select: ["_id", "name", "description", "slug", "createdAt"] as const,
        where: {
          createdAt: {
            $gte: new Date("2020-01-01T00:00:00Z"),
            $lt: new Date("2027-01-01T00:00:00Z"),
          },
        },
        groupBy: {
          by: ["createdAt"],
          aggregates: [
            {
              as: "itemsCreatedIn2025",
              fn: "$count",
              on: "_id",
            },
          ],
        },
      });
      if (isErrorResponse(response)) {
        // Handle error response
        return;
      }
      const docs = response.executor?.documents;
      if (docs) {
        setCategories(docs);
      }
    };
    fetch();
  }, []);

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      {categories.map((category) => (
        <div key={category._id}>
          <h2>{category.name}</h2>
          <p>{category.description}</p>
          <p>Slug: {category.slug}</p>
          <p>Created At: {category.createdAt.toString()}</p>
        </div>
      ))}
    </>
  );
}

export default App;
