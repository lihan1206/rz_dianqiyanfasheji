import React from "react";
import { Alert, Button, Space } from "antd";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Space direction="vertical" style={{ width: "100%", padding: 24 }}>
          <Alert
            type="error"
            message="页面出现异常"
            description={this.state.error?.message || "请刷新页面后重试"}
            showIcon
          />
          <Button type="primary" onClick={() => window.location.reload()}>
            刷新页面
          </Button>
        </Space>
      );
    }

    return this.props.children;
  }
}
