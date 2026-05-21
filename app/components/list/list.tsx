import { useNavigate } from "react-router"
import Md from "../markdown/md"
export const ListContainer: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => {
    return (
        <div className={"flex flex-col gap-2 w-full max-w-full overflow-x-hidden " + (className || "")} >
            {children}
        </div>
    )
}

export const ListItem: React.FC<{
    children?: React.ReactNode,
    linkTo?: string,
    title: string,
    subtitle?: string,
    image?: string,
    swapSubtitleAndTitle?: boolean,
    className?: string,
    markdown?: boolean,
    adminColors?: boolean

}> = ({ children, linkTo, title, subtitle, image, swapSubtitleAndTitle, className: cName, markdown, adminColors }) => {
    const navigate = useNavigate()
    if (adminColors) {
        cName = (cName || '') + ' bg-admin-800'
    } else {
        cName = (cName || '') + ' bg-librelearn-800 '
    }
    return (
        <div className={" rounded-xl p-4 cursor-pointer " + cName} onClick={() => navigate(linkTo || '#')}>
            <div className="flex flex-row gap-4">
                {image && <img src={image} alt="Image" className="w-12 h-12 rounded-full" />}
                <div className="flex flex-row w-full">
                    <div className="flex flex-col flex-1">
                        {swapSubtitleAndTitle && <p className="text-gray-200 text-sm">{subtitle}</p>}
                        {markdown ?
                            <Md content={title} /> :
                            <h1 className="font-semibold text-lg text-gray-100">{title}</h1>
                        }
                        {!swapSubtitleAndTitle && <p className="text-gray-200 text-sm">{subtitle}</p>}
                    </div>

                    <div onClick={(event) => event.stopPropagation()} className="flex flex-row ml-auto shrink-0">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}


export const LearnListItems: React.FC<{
    data: {
        from: string,
        to: string
    }[]
}> = (data) => {
    return (
        <div className="rounded-xl p-4 flex flex-col cursor-pointer bg-librelearn-800 m-4 w-[calc(100%-2rem)] box-border overflow-hidden min-w-0">
            <div className="flex items-center w-full min-w-0 gap-3">
                <h1 className="font-bold truncate min-w-0 flex-1 text-center">From</h1>
                <h1 className="font-bold truncate min-w-0 flex-1 text-center">To</h1>
            </div>
            {/* we need a line here */}
            <div className="border-t border-gray-600 my-2" />
            {data.data.map((item, index) => (
                <div key={index} className="flex items-center w-full min-w-0 gap-3">
                    <h1 className="font-semibold truncate min-w-0 flex-1 text-center">{item.from}</h1>
                    <h1 className="font-semibold truncate min-w-0 flex-1 text-center">{item.to}</h1>
                </div>
            ))}
        </div>
    )
}