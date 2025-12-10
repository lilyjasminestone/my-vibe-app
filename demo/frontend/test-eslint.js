// 测试文件 - 故意添加一些 ESLint 错误
import React from "react";
import { useState } from "react";;

const TestComponent = () => {
  const [count, setCount] = useState(0);;

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  )
};;

export default TestComponent
