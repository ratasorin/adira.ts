import type { Request, Response } from "express";
import { z } from "zod";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { readJob } from "../../pdf/jobs";
import { artifactExists, artifactPath } from "../../pdf/cache";
import type { PdfJobStatus } from "../../pdf/contracts";
import type { ErrorResponse } from "../../types";
import { ApiError } from "../../utils/api-errors";

export const jobStatus = async (
  req: Request<{ id: string }, never, never, {}>,
  res: Response<PdfJobStatus | ErrorResponse>,
) => {
  const id = z.uuid().parse(req.params.id);
  const stored = await readJob(id, req.user!.id);
  if (!stored) throw new ApiError(404, "Preview job not found or expired");
  const { owner, hash, ...publicJob } = stored;
  res.setHeader("Cache-Control", "no-store");
  res.json(publicJob);
};

export const artifact = async (
  req: Request<{ id: string }, never, never, {}>,
  res: Response<Buffer | ErrorResponse>,
) => {
  const id = z.uuid().parse(req.params.id);
  const job = await readJob(id, req.user!.id);
  if (!job || job.status !== "ready" || !(await artifactExists(id))) {
    throw new ApiError(404, "Preview artifact not found or expired");
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="monefy-${id}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store");
  await pipeline(createReadStream(artifactPath(id)), res);
};
