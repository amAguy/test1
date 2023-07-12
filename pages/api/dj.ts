import getRandomSong from "@/src/utils/getRandomSong";
import getMostReplayed from "@/src/youtube/getMostReplayed";
import searchSong from "@/src/youtube/searchSong";
import { NextApiRequest, NextApiResponse } from "next";
import { pipeline } from "stream";
import { ReadableStream } from "stream/web";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    let songInfo = getRandomSong()
    let song = await searchSong(`${songInfo.name} by ${songInfo.artist}`)
    let mostReplayed = await getMostReplayed(song.videoDetails.videoId)

    if (!mostReplayed) return handler(req, res)

    let url = `https://www.youtube.com/watch?v=${song.videoDetails.videoId}`;
    let { start, end } = mostReplayed;
    const CHUNK_SIZE = 65536; // Adjust as needed

    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    const stream = new ReadableStream<ArrayBuffer>({
        start(controller) {
            let offset = start;
            let chunkSize = CHUNK_SIZE;
            let chunk = buffer.slice(offset, offset + chunkSize);
            while (chunk.byteLength > 0) {
                controller.enqueue(chunk);
                offset += chunkSize;
                chunk = buffer.slice(offset, offset + chunkSize);
            }
            controller.close();
        },
    });

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Length", end - start + 1);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${buffer.byteLength}`);
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.setHeader("Access-Control-Allow-Origin", "*");

    pipeline(stream, res, (err) => {
        if (err) {
            console.error(err);
            res.status(500).end();
        }
    })
}