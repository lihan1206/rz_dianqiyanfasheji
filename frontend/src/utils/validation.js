import { message } from "antd";

export const validateOrToast = (schema, value) => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    message.error(parsed.error.errors[0]?.message || "表单校验失败");
    return null;
  }
  return parsed.data;
};
