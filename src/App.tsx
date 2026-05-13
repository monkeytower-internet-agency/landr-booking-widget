import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function App() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>LANDR Booking Widget</CardTitle>
          <CardDescription>
            Scaffold OK. Customer flow lands in landr-e10.2.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled>Coming soon</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
