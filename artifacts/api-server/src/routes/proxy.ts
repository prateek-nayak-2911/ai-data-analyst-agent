import { Router, type IRouter, type Request, type Response } from "express";
import http from "http";

const router: IRouter = Router();

function makeProxy(prefix: string) {
  return (req: Request, res: Response): void => {
    // req.path is relative to the mount point, so reconstruct full API path
    const subPath = req.path === "/" ? "" : req.path;
    const queryString = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const fullPath = `/api/${prefix}${subPath}${queryString}`;

    const options: http.RequestOptions = {
      hostname: "localhost",
      port: 8000,
      path: fullPath,
      method: req.method,
      headers: {
        ...req.headers,
        host: "localhost:8000",
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode ?? 500);
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        if (value !== undefined) {
          res.setHeader(key, value);
        }
      });
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      res.status(502).json({ error: "Python backend unavailable", details: err.message });
    });

    if (req.method !== "GET" && req.method !== "HEAD") {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  };
}

router.use("/datasets", makeProxy("datasets"));
router.use("/reports", makeProxy("reports"));
router.use("/chat", makeProxy("chat"));

export default router;
