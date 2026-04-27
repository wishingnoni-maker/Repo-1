import type { Request, Response, NextFunction } from "express";

export const requireAdminKey = (req: Request, res: Response, next: NextFunction) => {
  const configuredKey = process.env.ADMIN_KEY;
  if (!configuredKey) {
    return next();
  }

  const suppliedKey = req.header("x-admin-key") ?? req.body?.adminKey ?? req.query.adminKey;
  if (suppliedKey !== configuredKey) {
    return res.status(401).json({ message: "Invalid admin key." });
  }

  next();
};
