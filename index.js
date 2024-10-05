const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

class AssetMapPlugin {
    constructor(options = {}) {
        this.options = options;
    }

    apply(compiler) {
        compiler.hooks.entryOption.tap('AssetMapPlugin', (context, entry) => {
            const walkDirSync = (dir) => {
                const entryName = dir === '.' ? 'main' : path.join('pages', dir);
                const dirPath = path.join(compiler.context, 'pages', dir);
                const imports = [];

                try {
                    const files = fs.readdirSync(dirPath);

                    files.forEach((file) => {
                        const filePath = path.join(compiler.context, 'pages', dir, file);
                        const stat = fs.statSync(filePath);

                        if (stat.isDirectory()) {
                            walkDirSync(path.join(dir, file));
                        } else if (this.isImage(file) || file === 'index.ts' || file === 'styles.scss') {
                            imports.push(filePath);
                        }
                    });

                    entry[entryName] = {import: imports};

                } catch (err) {
                    console.error(`Error processing directory ${dirPath}:`, err);
                    throw err;
                }
            };

            walkDirSync('.');
        });

        compiler.hooks.emit.tapAsync('AssetMapPlugin', async (compilation, callback) => {
            const entrypoints = {};
            const images = {};
            const publicPath = compilation.options.output.publicPath || '/';
            const outputPath = path.relative(compiler.context, compilation.options.output.path);

            try {
                for (const [entryName, entry] of compilation.entrypoints) {
                    entrypoints[entryName] = entry.getFiles().map(f => path.join(publicPath, f));
                }

                for (const [entryName, info] of compilation.assetsInfo) {
                    if (this.isImage(entryName)) {
                        images[info.sourceFilename.replace(/^pages\//, '')] = path.join(publicPath, entryName);
                    }
                }

                await fsPromises.writeFile(
                    path.join(compiler.context, 'webpack-assets.json'),
                    JSON.stringify({
                        outputPath,
                        entrypoints,
                        images
                    }, null, 2)
                );

                callback();

            } catch (err) {
                console.error('Error during emit phase:', err);
                callback(err);
            }
        });
    }

    isImage(assetName) {
        return /\.(png|jpe?g|gif|svg)$/i.test(assetName);
    }
}

module.exports = AssetMapPlugin;
