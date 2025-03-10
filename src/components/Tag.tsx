import React from 'react'
import Link from 'next/link'

const Tag = ({ text }: { text: string }) => {
  return (
    <Link href={`/tags/${text}/pages/1`}>
      <a className="mr-3 text-sm font-medium text-blue-500 uppercase hover:text-blue-600 dark:hover:text-blue-400">
        {text.split(' ').join('-')}
      </a>
    </Link>
  )
}

export default Tag
