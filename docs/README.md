---
sidebar: auto
---

# RedSpot

## Get Started Immediately

```
$ npx redspot-new erc20
```

(npx is a package runner tool that comes with npm 5.2+ and higher, it ensures that you always install the latest version)

Redspot will create a directory called flipper inside the current folder.

Once the installation is done, you can open your project folder:

```
$ cd erc20
```

Inside the newly created project, you can run some built-in commands:

#### `npx redspot compile`

Compile your contract into wasm

#### `npx redspot test`

Test your contract

#### `npx redspot console`

Open the interactive javascript console

#### `npx redspot help`

Get help information

![](https://user-images.githubusercontent.com/69485494/97970303-344d3e00-1e26-11eb-9030-843ea77bdd31.gif)



## Install from template

Redspot provides several contract templates: `flipper`, `delegator` , `dns`, `erc20`, `erc721` , `incrementer`, `multisig_plain`. You can intall them like this:

```
$ npx redspot-new <app-name> --template <template-name>
```

For instance: `npx redspot-new flipper --template flipper`

The default contract template is `erc20`.

