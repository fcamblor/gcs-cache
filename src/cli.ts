#!/usr/bin/env node

import 'zx'
import {hideBin} from "yargs/helpers";
import yargs, {Options} from "yargs";
import {CacheCoordinates, NamedDirectory} from "./CachePersistor.js";
import {auth} from "./commands/auth.js";
import {storeFS} from "./commands/store-fs.js";
import {loadFS} from "./commands/load-fs.js";
import {cachedFS} from "./commands/cached-fs.js";
import {fsExists} from "./commands/fs-exists.js";


type CoordsKeys = "bucket-url"|"app"|"branch"|"cache-name";
const cacheCoordsOptions: Record<CoordsKeys, Options> = {
    'bucket-url': {
        type: 'string',
        demandOption: true,
        describe: 'bucket url (gs://<name>)'
    },
    'branch': {
        type: 'string',
        describe: 'cache branch name'
    },
    'app': {
        type: 'string',
        describe: 'your app identifier'
    },
    'cache-name': {
        type: 'string',
        demandOption: true,
        describe: 'cache name'
    }
};

function coordsFromOpts(argv: {[key in CoordsKeys]: string|unknown}): CacheCoordinates {
    return {
        bucketUrl: argv["bucket-url"] as string,
        app: argv["app"] as string,
        branch: (argv["branch"] || 'unknown-branch') as string,
        cacheName: argv["cache-name"] as string
    };
}

function namedDirectoriesFrom(nameableDirs: string[]): NamedDirectory[] {
    return nameableDirs.map(nameableDir => {
        const [chunk1, chunk2] = nameableDir.split(":") as [string, string|undefined];
        return { name: chunk1, path: chunk2 || chunk1 };
    })
}

yargs(hideBin(process.argv))
    .command(["auth"], 'authenticates against your gcs bucket', (yargs) =>
        yargs.options({
            'key-config-url': {
                type: 'string',
                describe: 'url from where to download your google service account JSON key'
            },
            'key-config-file': {
                type: 'string',
                describe: 'local file containing your google service account JSON key'
            }
        }).check((argv, options) => {
            if(!argv['key-config-url'] && !argv['key-config-file']) {
                throw new Error("Either --key-config-url or --key-config-file options need to be set");
            }
            return true;
        }), async (argv) => {
            await auth({
                keyConfig: (argv["key-config-url"] || argv["key-config-file"]) as string,
                type: argv["key-config-url"]?'url':'file'
            });
        }
    ).command("store-fs [nameableDirectories..]", 'Stores directories into filesystem cache', (yargs) =>
        yargs.options({
            ...cacheCoordsOptions,
            'skip-compress': {
                type: 'boolean',
                describe: 'avoids compressing files prior to sending it in store'
            }
        }), async (argv) => {

            const coords = coordsFromOpts(argv);
            let compressed = !argv["skip-compress"];
            const directories = namedDirectoriesFrom((argv["nameableDirectories"] || []) as string[]);

            await storeFS({
                coords, compressed, directories
            });
        }
    ).command("load-fs [nameableDirectories..]", 'Loads directories previously stored into filesystem cache', (yargs) =>
        yargs.options({
            ...cacheCoordsOptions,
            'on-inexistant-cache': {
                type: 'string',
                default: 'ignore',
                describe: `allows to either ignore or fail the command when the cache doesn't exist`,
                choices: ['ignore', 'warn', 'fail']
            }
        }), async (argv) => {

            const coords = coordsFromOpts(argv);
            const directories = namedDirectoriesFrom((argv["nameableDirectories"] || []) as string[]);
            const onInexistantCache = argv['on-inexistant-cache'] as "ignore"|"warn"|"fail";

            await loadFS({
                coords, directories, onInexistantCache
            });
        }
    ).command("fs-exists", 'Tells if a cache coordinate exists or not', (yargs) =>
        yargs.options(cacheCoordsOptions), async (argv) => {
            const coords = coordsFromOpts(argv);

            const exists = await fsExists({ coords });
            if(exists) {
                console.log("Cache exists !");
            } else {
                console.error(`Cache for coords ${JSON.stringify(coords)} doesn't exist !`)
                process.exit(1)
            }
        }
    ).command("cached-fs [nameableDirectories..]", 'Either loads cached filesystem or rebuild it from scratch based on a checksum', (yargs) =>
        yargs.options({
            ...cacheCoordsOptions,
            'checksum-file': {
                type: 'string',
                demandOption: false,
                describe: 'path to file used to guess if cache can be retrieved as is or if it should be invalidated'
            },
            'checksum-value': {
                type: 'string',
                demandOption: false,
                describe: 'hardcoded checksum value used to guess if cache can be retrieved as is or if it should be invalidated'
            },
            'cacheable-command': {
                type: 'string',
                demandOption: true,
                describe: 'command to execute to reproduce cache when it gets invalidated'
            },
            'root-dir': {
                type: 'string',
                demandOption: false,
                describe: 'root directory from where cacheable-command is executed'
            },
            'skip-compress': {
                type: 'boolean',
                describe: 'avoids compressing files prior to sending it in store'
            }
        }).check((argv, options) => {
            if(!argv['nameableDirectories'] || (argv['nameableDirectories'] as string[]).length===0) {
                throw new Error("At least 1 directory must be provided !")
            }
            if(!argv['checksum-file'] && !argv['checksum-value']) {
                throw new Error("Either checksum-file or checksum-value needs to be provided")
            }
            return true;
        }), async (argv) => {
            const coords = coordsFromOpts(argv);
            const compressed = !argv["skip-compress"];
            const directories = namedDirectoriesFrom((argv["nameableDirectories"] || []) as string[]);

            await cachedFS({
                coords, compressed, directories,
                checksumFile: argv["checksum-file"] as string|undefined,
                checksumValue: argv["checksum-value"] as string|undefined,
                cacheableCommand: argv["cacheable-command"] as string,
                rootDir: argv["root-dir"] as string
            });
        }
    ).help().argv
