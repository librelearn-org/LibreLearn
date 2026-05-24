import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import config from '~/utils/config'

export default function Md({ content }: { content: string }) {

    return (
        <Markdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
                h1: ({ children }) => <h1 className="text-3xl font-bold mb-4">{children}</h1>,
                h2: ({ children }) => <h2 className="text-2xl font-bold mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xl font-bold mb-2">{children}</h3>,
                h4: ({ children }) => <h4 className="text-lg font-bold mb-1">{children}</h4>,
                h5: ({ children }) => <h5 className="text-base font-bold mb-1">{children}</h5>,
                h6: ({ children }) => <h6 className="text-sm font-bold mb-1">{children}</h6>,
                blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2">{children}</blockquote>,
                // TODO: instelbaar maken in db config, anders defaults
                a: ({ children, href }) => (config.defaults.forum.allowForumLinks) ? <a href={href} className="text-blue-500 hover:underline">{children}</a> : <span>Link removed</span>,
                img: ({ src, alt }) => (config.defaults.forum.allowForumImages) ? <img src={src} alt={alt} /> : <span>Image removed</span>,
                ul: ({ children }) => <ul className="list-disc list-inside my-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside my-2">{children}</ol>,
                li: ({ children }) => <li className="my-1">{children}</li>,
                table: ({ children }) => <table className="table-auto w-full my-4 border-collapse border border-gray-300">{children}</table>,
                thead: ({ children }) => <thead className=" bg-librelearn-700">{children}</thead>,
                tbody: ({ children }) => <tbody>{children}</tbody>,
                tr: ({ children }) => <tr className="border border-gray-300">{children}</tr>,
                th: ({ children }) => <th className="border border-gray-300 px-4 py-2 text-left">{children}</th>,
                td: ({ children }) => <td className="border border-gray-300 px-4 py-2">{children}</td>,
            }}
        >
            {content}
        </Markdown>
    )
}