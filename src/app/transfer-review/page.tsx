"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { TransferResult } from "@/types/transfer"
import { TransferReview } from "@/components/TransferReview"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function TransferReviewPage() {
  const router = useRouter()
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const savedResult = localStorage.getItem("latestTransferResult")
    if (savedResult) {
      setTransferResult(JSON.parse(savedResult))
    } else {
      // No result found, redirect to home
      router.push("/")
    }
    setIsLoading(false)
  }, [router])

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!transferResult) {
    return null
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Transfer
          </Button>
        </div>
        
        <TransferReview result={transferResult} onComplete={async (matches) => {
          // Save the matches and navigate to import
          localStorage.setItem("selectedMatches", JSON.stringify(matches));
          router.push("/transfer-import");
        }} />
      </div>
    </div>
  )
}