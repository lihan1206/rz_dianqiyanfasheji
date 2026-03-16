export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query
  });

  if (!result.success) {
    return res.status(400).json({
      message: "请求参数校验失败",
      details: result.error.errors
    });
  }

  req.validated = result.data;
  next();
};
