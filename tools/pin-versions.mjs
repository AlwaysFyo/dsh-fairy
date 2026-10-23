#!/usr/bin/env node
/**
 * Rewrites workspace `link:` dependencies into published version ranges.
 *
 * The dev profile keeps its own `link:` entries, so local iteration is
 * unaffected; the packages themselves need real version ranges to be
 * installable from a registry (or a tarball) the way the market installs them.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pkgRoot = join(root, 'packages');

const manifests = [];
for (const dir of await readdir(pkgRoot)) {
	const file = join(pkgRoot, dir, 'package.json');
	try {
		manifests.push({ file, manifest: JSON.parse(await readFile(file, 'utf8')) });
	} catch {
		/* not a package */
	}
}

const versions = new Map(manifests.map(({ manifest }) => [manifest.name, manifest.version]));
const touched = [];

for (const entry of manifests) {
	let changed = false;
	for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
		const deps = entry.manifest[field];
		if (!deps) continue;
		for (const [dep, spec] of Object.entries(deps)) {
			if (!/^(link|workspace):/.test(String(spec))) continue;
			const target = versions.get(dep);
			if (!target) continue;
			deps[dep] = `^${target}`;
			changed = true;
		}
	}
	if (changed) {
		await writeFile(entry.file, `${JSON.stringify(entry.manifest, null, '\t')}\n`, 'utf8');
		touched.push(entry.manifest.name);
	}
}

console.log(`workspace versions: ${[...versions].map(([n, v]) => `${n}@${v}`).join(', ')}`);
console.log(`rewritten: ${touched.length ? touched.join(', ') : '(none)'}`);
