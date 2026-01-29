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

const queryCategories = api("/categories", "GET");

const { run: runQueryCategories } = queryCategories({
  query: {
    include: ["createdBy"],
    rows: (r) =>
      r({
        select: [
          "name",
          "slug",
          "createdAt",
          "createdBy",
          "isActive",
          "description",
        ],
      }),
    groups: (g) => ({
      bySlugs: g({
        by: ["createdBy.name"],
        aggregates: [{ on: "_id", as: "totalIn", fn: "$count" }],
      }),
    }),
  },
});

type CategoryResponse = NonNullable<
  Exclude<
    Awaited<ReturnType<typeof runQueryCategories>>,
    ErrorResponse
  >["executor"]
>["rows"];

type SlugGroups = NonNullable<
  NonNullable<
    Exclude<
      Awaited<ReturnType<typeof runQueryCategories>>,
      ErrorResponse
    >["executor"]
  >["groups"]
>["bySlugs"];

function App() {
  const [categories, setCategories] = useState<CategoryResponse>([]);
  const [groups, setGroups] = useState<SlugGroups | undefined>();

  console.log({ groups });

  useEffect(() => {
    const fetch = async () => {
      const response = await runQueryCategories();
      if (isErrorResponse(response)) {
        // Handle error response
        return;
      }
      const rows = response.executor?.rows;
      const groups = response.executor?.groups;
      const bySlugs = groups?.bySlugs;

      if (bySlugs) {
        setGroups(bySlugs);
      }

      if (rows) {
        setCategories(rows);
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

      {groups?.map((g) => {
        return (
          <div>
            createdBy: {g.category["createdBy.name"]}
            Total: {g.totalIn}
          </div>
        );
      })}
    </>
  );
}

export default App;
