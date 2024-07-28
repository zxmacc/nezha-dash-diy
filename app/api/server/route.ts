
import { NezhaAPI, ServerApi } from "@/app/types/nezha-api";
import { MakeOptional } from "@/app/types/utils";
import { NextResponse } from "next/server";
import { DateTime } from "luxon";

export async function GET(_: Request) {
    if (!process.env.NezhaBaseUrl) {
        return NextResponse.json({ error: 'NezhaBaseUrl is not set' }, { status: 400 })
    }

    // Remove trailing slash
    var nezhaBaseUrl = process.env.NezhaBaseUrl;

    if (process.env.NezhaBaseUrl[process.env.NezhaBaseUrl.length - 1] === '/') {
        nezhaBaseUrl = process.env.NezhaBaseUrl.slice(0, -1);
    }

    try {
        const response = await fetch(nezhaBaseUrl+ '/api/v1/server/details',{
            headers: {
                'Authorization': process.env.NezhaAuth as string
            },
            next:{
                revalidate:1
            }
        });
        const nezhaData = (await response.json()).result as NezhaAPI[];
        const data: ServerApi = {
            live_servers: 0,
            offline_servers: 0,
            total_bandwidth: 0,
            total_price: 0,
            result: []
        }

        data.result = nezhaData.map((element: MakeOptional<NezhaAPI, "ipv4" | "ipv6" | "valid_ip">) => {
            if (DateTime.now().toUnixInteger() - element.last_active > 300) {
                data.offline_servers += 1;
            } else {
                data.live_servers += 1;
            }
            data.total_bandwidth += element.status.NetOutTransfer;

            delete element.ipv4;
            delete element.ipv6;
            delete element.valid_ip;

            let price = 0;
            const priceRegex = /(\$|\¥)\d+(\.\d+)?(y|m)/;
            const priceMatch = element.name.match(priceRegex);
            if (priceMatch) {
                element.price = priceMatch[0].slice(0, -1);
                const price_ = parseFloat(priceMatch[0].slice(1, -1));
                price = isNaN(price_) ? 0 : price_;
                if (priceMatch[0].charAt(0) === "$") {
                    price = price * 7.3;
                }
                if (priceMatch[0].charAt(priceMatch[0].length - 1) === "y") {
                    price = price / 12;
                    element.price = element.price + "/年";
                } else {
                    element.price = element.price + "/月";
                }
                element.name = element.name.replace(priceRegex, "").trim();
            }
            data.total_price += price;
            const dateRegex = /@(\d{6})/;
            const nameMatch = element.name.match(dateRegex);
            if (nameMatch) {
                const date = DateTime.fromFormat(nameMatch[0], "@yyMMdd").toFormat("yyyy-MM-dd");
                element.date = date;
                element.name = element.name.replace(dateRegex, "").trim();
            }
            return element;
        });

        return NextResponse.json(data, { status: 200 })
    } catch (error) {
        return NextResponse.json({ error: error }, { status: 200 })
    }

}