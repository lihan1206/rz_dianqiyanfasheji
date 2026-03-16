import { useState } from "react";
import { Button, Card, Form, Input, Space, Typography } from "antd";
import { z } from "zod";
import { http } from "../api/client";
import { validateOrToast } from "../utils/validation";

const schema = z.object({
  username: z.string().min(3, "用户名至少 3 位"),
  password: z.string().min(6, "密码至少 6 位")
});

export default function LoginPage({ onLogin }) {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    const parsed = validateOrToast(schema, values);
    if (!parsed) return;

    setLoading(true);
    try {
      const res = await http.post("/auth/login", parsed);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      onLogin(res.data.user);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card" bordered={false}>
        <Space direction="vertical" size={18} style={{ width: "100%" }}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            电气研发设计管理系统
          </Typography.Title>
          <Typography.Text type="secondary">
            请使用系统账号登录，进入项目协同、图纸管理、BOM 与审批流程。
          </Typography.Text>
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}> 
              <Input placeholder="例如：admin" />
            </Form.Item>
            <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}> 
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录系统
            </Button>
          </Form>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            测试账号：`admin / 123456`
          </Typography.Paragraph>
        </Space>
      </Card>
    </div>
  );
}
