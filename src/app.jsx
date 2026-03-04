import { useLaunch } from '@tarojs/taro'
import ThemeProvider from '@/components/ThemeProvider'
import './app.scss'

function App({ children }) {
  useLaunch(() => {
    console.log('[App] launched')
  })

  return <ThemeProvider>{children}</ThemeProvider>
}

export default App
