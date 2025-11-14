import mongoose, { Model, Schema } from "mongoose";
function buildSuffixMerge(
  varName: string,
  suffix: string,
  fieldAlias: string
): any {
  const parts = suffix.split(".");
  const [head, ...rest] = parts;


  if (!head) return {};


  if (rest.length === 0) {
    return {
      [head]: {
        $arrayElemAt: [
          {
            $filter: {
              input: `$${fieldAlias}`,
              as: "doc",
              cond: { $eq: ["$$doc._id", `$$${varName}.${head}`] },
            },
          },
          0,
        ],
      },
    };
  }

  return {
    [head]: {
      $mergeObjects: [
        `$$${varName}.${head}`,
        buildSuffixMerge(`${varName}.${head}`, rest.join("."), fieldAlias),
      ],
    },
  };
}

function buildMergePath(varName: string, path: string, inner: any): any {
  const parts = path.split(".");

  if (parts.length === 0) return inner;

  const [head, ...rest] = parts;

  if (!head) return inner;

  if (rest.length === 0) {
    return {
      $mergeObjects: [`$$${varName}`, { [head]: Object.values(inner)[0] }],
    };
  }

  return {
    $mergeObjects: [
      `$$${varName}`,
      {
        [head]: buildMergePath(`${varName}.${head}`, rest.join("."), inner),
      },
    ],
  };
}

function buildMap(
  objectsBetweenArrays: string[],
  prefix: string,
  fieldAlias: string,
  suffix: string
): any {
  if (objectsBetweenArrays.length === 0) return [];

  const [head, ...rest] = objectsBetweenArrays;

  if (!head) return [];

  const isLast = rest.length === 0;

  const varName = head.replace(/\./g, "_");
  const selector = prefix ? `${prefix}.${head}` : head;

  if (isLast) {
    if (!suffix) {
      // --- Case A: suffix empty → direct replacement
      return {
        [head]: {
          $map: {
            input: `$${selector}`,
            as: varName,
            in: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: `$${fieldAlias}`,
                    as: "doc",
                    cond: { $eq: ["$$doc._id", `$$${varName}`] },
                  },
                },
                0,
              ],
            },
          },
        },
      };
    } else {
      // --- Case B: suffix not empty → merge original + looked-up
      return {
        [head]: {
          $map: {
            input: `$${selector}`,
            as: varName,
            in: {
              $mergeObjects: [
                `$$${varName}`,
                buildSuffixMerge(varName, suffix, fieldAlias),
              ],
            },
          },
        },
      };
    }
  } else {
    if (!rest[0]) return {};

    // recurse down
    return {
      [head]: {
        $map: {
          input: `$${selector}`,
          as: varName,
          in: buildMergePath(
            varName,
            rest[0],
            buildMap(rest, `$${varName}`, fieldAlias, suffix)
          ),
        },
      },
    };
  }
}

export function buildPopulatePipeline(
  model: Model<any>,
  include: string
): any[] {
  const parts = include.split(".");
  let objectsBetweenArrays: string[] = [];
  let schema: Schema | undefined = model.schema;
  let currentPath = "";
  let pathBetweenArrays = "";
  let suffix = "";
  let i = 0;

  while (i < parts.length) {
    const seg = parts[i];

    if (!seg) throw new Error("[Segmentation Fault] Cannot reach outside 'parts' array bounds!")

    currentPath = currentPath ? `${currentPath}.${seg}` : seg;
    pathBetweenArrays = pathBetweenArrays ? `${pathBetweenArrays}.${seg}` : seg;
    suffix = suffix ? `${suffix}.${seg}` : seg;

    const pathSchema: any = schema?.path(currentPath);

    // Case 1: it's an array (subdoc array or ref array)
    if (
      pathSchema &&
      (pathSchema.instance === "Array" || pathSchema.$isMongooseArray)
    ) {
      objectsBetweenArrays.push(pathBetweenArrays);
      suffix = suffix.replaceAll(pathBetweenArrays, "");
      pathBetweenArrays = "";
    }

    // Case 2: it's a ref → stop here, emit lookup + recurse
    if (pathSchema?.options?.ref || pathSchema?.caster?.options?.ref) {
      const refModelName =
        pathSchema.options?.ref || pathSchema.caster?.options?.ref as string;
        
      const refModel = mongoose.model(refModelName) as any;

      const alias = `_${currentPath.replace(/\./g, "_")}`;

      const remaining = parts.slice(i + 1).join(".");
      const nestedPipeline = remaining
        ? buildPopulatePipeline(refModel, remaining)
        : [];

      const lookup = {
        $lookup: {
          from: refModel.collection.name,
          localField: currentPath,
          foreignField: "_id",
          as: alias,
          pipeline: nestedPipeline,
        },
      };

      if (objectsBetweenArrays.length === 0) {
        return [
          lookup,
          { $unwind: { path: `$${alias}`, preserveNullAndEmptyArrays: true } },
          {
            $set: {
              [currentPath]: `$${alias}`,
            },
          },
          { $unset: alias },
        ];
      }

      const rebuild = {
        $set: buildMap(objectsBetweenArrays, "", alias, suffix),
      };

      const cleanup = { $unset: alias };

      return [lookup, rebuild, cleanup];
    }

    i++;
  }

  return []; // no refs found
}
