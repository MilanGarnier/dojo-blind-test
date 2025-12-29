import { mkdir, writeFile } from 'fs/promises';

import openapi from '../openapi.json' with { type: 'json' };

const targetDirectory = 'src/lib/spotify/model';

async function generateSpotifyClient() {
    console.log('\nLaunched generate-spotify-client script');
    console.log('Generating Spotify client from OpenApi spec file...\n');
    await mkdir(targetDirectory, { recursive: true }); // Generate target directory

    const schemas = openapi.components.schemas;
    const typesToGenerate = Object.keys(schemas);

    for (const typeName of typesToGenerate) {
        const typeSchema = schemas[typeName];
        generateType(typeName, typeSchema);
    }
}

function generateType(typeName, typeSchema) {
    console.log(`Generating type ${typeName}...`);

    var imports = {};

    const generatedCode = getGeneratedCode(typeName, typeSchema, imports);

    var importsCode = '';
    for (const [key, value] of Object.entries(imports)) {
        importsCode += `import { ${key} } from '${value}';\n`;
    }

    writeFile(
        `${targetDirectory}/${typeName}.ts`,
        importsCode + '\n\n' + generatedCode,
    );
}

function getGeneratedCode(typeName, typeSchema, imports) {
    const generatedType = getGeneratedType(typeSchema, imports);

    return `export type ${typeName} = ${generatedType};`;
}

function getGeneratedType(typeSchema, imports) {
    const schemaType = typeSchema.type;

    switch (schemaType) {
        case 'number':
            return 'number';
        case 'integer':
            return 'number';
        case 'string':
            if (typeSchema.enum) {
                const enumValues = typeSchema.enum
                    .map(value => `'${value}'`)
                    .join(' | ');
                return `(${enumValues})`;
            } else {
                return 'string';
            }
        case 'boolean':
            return 'boolean';
        case 'array':
            // TODO!
            return getGeneratedType(typeSchema.items, imports) + '[]';
        case 'object':
            const props = typeSchema.properties;
            var s = '{\r\n';

            for (const prop in props) {
                var isRequired = false;
                for (const p in typeSchema.required) {
                    if (typeSchema.required[p] === prop) {
                        isRequired = true;
                        break;
                    }
                }
                var required = isRequired ? '' : '?';
                const propTypeGenerated = getGeneratedType(
                    props[prop],
                    imports,
                );

                const propTypeName = prop;
                s += `    ${propTypeName}${required}: ${propTypeGenerated};\r\n`;
            }
            s += '}';
            return s;
        default:
            if (typeSchema['allOf']) {
                const arr = typeSchema['allOf'];
                var a = '(';
                for (var i = 0; i < arr.length; i++) {
                    const t = getGeneratedType(arr[i], imports);
                    a += t;
                    if (i < arr.length - 1) {
                        a += ' & ';
                    }
                }
                a += ')';
                return a;
            } else if (typeSchema['oneOf']) {
                const arr = typeSchema['oneOf'];
                var a = '(';
                for (var i = 0; i < arr.length; i++) {
                    const t = getGeneratedType(arr[i], imports);
                    a += t;
                    if (i < arr.length - 1) {
                        a += ' | ';
                    }
                }
                a += ')';
                return a;
            } else if (typeSchema['$ref']) {
                const refTypeName = typeSchema['$ref'].split('/').pop(); // assumes every file ends up in the same directory
                if (!imports[refTypeName]) {
                    // add to imports
                    imports[refTypeName] = `./${refTypeName}`;
                }
                return refTypeName;
            }
            console.log('unsupported element', typeSchema);
            return '';
    }
}

generateSpotifyClient();
