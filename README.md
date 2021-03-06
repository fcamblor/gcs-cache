> Simple CLI to transform a gcs bucket into your filesystem cache during your builds

# Overview

`gcs-cache` is a CLI utility on top of `gsutil` in order to facilitate storing & loading filesystem
content to/from a google-cloud-storage bucket.

## Features

*   Authenticate against a gcloud service account to gain access to your gcs bucket
*   Provide caching mechanism : for example, you can decide to cache your `node_modules` folder
    and rely on its cached content based on `package.json` checksum :
    *    if `package.json` checksum in the cache is the same than your local `package.json` checksum,
         then the CLI will download your cached `node_modules` folder
    *    otherwise, a new `npm install` will be performed locally, and the resulting `node_modules`
         content will be cached for further use
    
*   Store local filesystem to your gcs bucket
*   Load remote gcs bucket into your local filesystem
*   Decide whether you want to compress (or not) your files prior to storing it into gcs

# Installation

`npm install -g gcs-cache`

## Important notes

- in order to make it work, you will need `gcloud` and `gsutil` commands available
  into your `PATH`. You can find a `utilities/install-gcloud.sh` installation script utility to 
  facilitate this in the repository : 

```
curl "https://raw.githubusercontent.com/fcamblor/gcs-cache/1.2.4/utilities/install-gcloud.sh" | bash -s [<path/to/bin/folder>] [<path/to/gcloud/installation/folder>]
```  

- you will need `node@14` to run it properly

# Usages

## Authenticate against gcloud

```
gcs-cache auth "--key-config-url=https://url/targetting/google-service-account.json"

-or-

gcs-cache auth "--key-config-file=/local/path/to/google-service-account.json"
```

This is a required step to authenticate against your google cloud service account prior to making any
manipulation through the CLI.

## Synchronize a cacheable filesystem

```
gcs-cache cached-fs --bucket-url=gs://my-bucket --app=my-app --branch=my-branch --cache-name=npm-packages --checksum-file=package.json "--cacheable-command=npm install" node_modules:node_modules
```

This will :
- Retrieve checksum from `checksum-file` (`package.json`)
- Compare it with gcs `npm-packages` cache metadata for branch `my-branch` in app `my-app` :
    - If checksums differ, then `cacheable-command` (`npm install`) will be executed, and 
      `node_modules` directory will then be put into `npm-packages` cache for branch `my-branch`
    - If checksums are the same, then `npm-packages` cache will be downloaded and applied on `node_modules`
      directory

## Put filesystem into the cache

```
gcs-cache store-fs --bucket-url=gs://my-bucket --app=my-app --branch=my-branch --cache-name=my-cache directory1:directory1 directory2:./path/to/directory2
```

This will store `directory1` and `directory2` contents into cache `my-cache` for branch `my-branch` in app `my-app`

You can avoid passing any directory: in that case, the whole **current** directory content will be put into the cache.


## Get filesystem from the cache

```
gcs-cache load-fs --bucket-url=gs://my-bucket --app=my-app --branch=my-branch --cache-name=my-cache directory1:directory1 directory2:./path/to/directory2
```

This will load `directory1` and `directory2` content from cache `my-cache` for branch `my-branch` in app `my-appp`
into current directory's `directory1` and `directory2`

You can avoid passing any directory: in that case, the special `__all__` cache content will be
put into current directory.

## Nameable directories

Whenever you provide directories to `cached-fs` / `store-fs` / `load-fs` commands, those directories are
"named" directories, following format `content-name:directory-path`

When `content-name` and `directory-path` are the same, you can shortcut it to simply `directory-path`, meaning that 
those 2 different commands are the same :

```
gcs-cache store-fs --bucket-url=gs://my-bucket --app=my-app --branch=my-branch --content-name=my-cache directory1:directory1 directory2:./path/to/directory2

gcs-cache store-fs --bucket-url=gs://my-bucket --app=my-app --branch=my-branch --content-name=my-cache directory1 directory2:./path/to/directory2
```


# Under the hood: Storage spec in gcs

Cache contents will differ depending on whether content has been created using `cached-fs` 
or `store-fs`/`load-fs` commands.

Every caches can be resolved through 4 coordinates :
- bucket url : `gs://my-bucket`
- app : a unique app id identifier used to isolate contents from 1 app to another inside the same bucket
  **Important note**: note that by giving access to a bucket, you give access to every app content
  stored on this bucket (no ACL is setup to limit access to apps content from a single bucket)
- branch name : when omitted, we fallback on the `unknown-branch` name
- cache name

## `cached-fs` content

Bucket `gs://my-bucket` cached content will differ depending on whether content is `compressed` or not.

For **compressed** content :
- `<app>/metadata/<branch-name>/<cache-name>.json` with following content :
```
{
    "checksum": "bc694811390c7b4da545a364a3993d7d",
    "compressed": true,
    "all": false
}
```
- `<app>/content/<branch-name>/<cache-name>/<directory1>.tar.gz` with compressed `directory1` content
- `<app>/content/<branch-name>/<cache-name>/<directory2>.tar.gz` with compressed `directory2` content

_etc._

For **uncompressed** content :
- `<app>/metadata/<branch-name>/<cache-name>.json` with following content :
```
{
    "checksum": "bc694811390c7b4da545a364a3993d7d",
    "compressed": false,
    "all": false
}
```
- `<app>/content/<branch-name>/<cache-name>/directory1/*` with `directory1` content
- `<app>/content/<branch-name>/<cache-name>/directory2/*` with `directory2` content

_etc._

## `store-fs` / `load-fs` content

Bucket `gs://my-bucket` cached content will differ depending on whether content is `compressed` or not.

For **compressed** content :
- `<app>/metadata/<branch-name>/<cache-name>.json` with following content :
```
{
    "compressed": true,
    "all": false
}
```
- `<app>/content/<branch-name>/<cache-name>/<directory1>.tar.gz` with compressed `directory1` content
- `<app>/content/<branch-name>/<cache-name>/<directory2>.tar.gz` with compressed `directory2` content

_etc._

For **uncompressed** content :
- `<app>/metadata/<branch-name>/<cache-name>.json` with following content :
```
{
    "compressed": false,
    "all": false
}
```
- `<app>/content/<branch-name>/<cache-name>/directory1/*` with `directory1` content
- `<app>/content/<branch-name>/<cache-name>/directory2/*` with `directory2` content

_etc._

When **no directory** is specificed to `store-fs` / `load-fs` commands, then have following content :
- `<app>/metadata/<branch-name>/<cache-name>.json` with following content :
```
{
    "compressed": true,
    "all": true
}
```
- `<app>/content/<branch-name>/<cache-name>/__all__.tar.gz` with compressed current directory content

_For **uncompressed no directory**, this is the same idea, except that `__all__.tar.gz` archive is replaced
by a `__all__` directory_
