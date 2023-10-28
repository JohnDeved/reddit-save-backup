// define type for store.json

// [
//   {
//     "id": "12t26o3",
//     "title": "Britt Blair is perfect",
//     "name": "t3_12t26o3",
//     "orgUrl": "https://i.imgur.com/FukkJ0s.gifv",
//     "cdnUrl": "https://cdn.discordapp.com/attachments/1118929807057616937/1119163601211621477/t3_13mp0bn.mp4",
//     "msgId": "1119163601668821172",
//     "msgUrl": "https://discord.com/channels/805615713842364426/1118929807057616937/1119163601668821172",
//     "created": 1684580890,
//     "height": 1062,
//     "width": 960
//   },
// ]

declare module '*/stored.json' {
  export interface Stored {
    id: string
    title: string
    name: string
    orgUrl: string
    cdnUrl: string | string[]
    msgId: string
    msgUrl: string
    created: number
    height: number
    width: number
  }
  const stored: Stored[]
  export default stored
}
