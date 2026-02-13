"use client"

import { useParams } from "next/navigation"

const Page = () => {
    const params = useParams()
    const roomId = params.roomId as string
  return (
    <div className=''>
        <p>hello</p>
    </div>
  )
}

export default Page