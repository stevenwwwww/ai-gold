import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, message, Typography } from 'antd'
import { changePassword } from '@/api/auth'

export default function PasswordPage() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onFinish = async (values: { oldPassword: string; newPassword: string; confirm: string }) => {
    if (values.newPassword !== values.confirm) {
      message.error('两次密码不一致')
      return
    }
    setLoading(true)
    try {
      await changePassword(values.oldPassword, values.newPassword)
      message.success('密码修改成功')
      navigate('/dashboard')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '修改失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="修改密码" style={{ maxWidth: 480 }}>
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item name="newPassword" label="新密码"
          rules={[{ required: true }, { min: 6, message: '至少 6 位' }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item name="confirm" label="确认新密码"
          rules={[{ required: true, message: '请确认密码' }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>确认修改</Button>
        </Form.Item>
      </Form>
    </Card>
  )
}
