# Earth texture sources

This folder contains local runtime copies used by the Three.js globe. Public release and commercial use still require a final manual rights review.

## Files

- `earth-day-realistic.jpg`
  - Source URL used: `https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg`
  - Source family: NASA Blue Marble Next Generation, cloudless topography and bathymetry.
  - Runtime size downloaded: 5400 x 2700.
  - Use in app: day-side color map.
  - Review note: verify NASA attribution, derivative resizing, and publication terms before public release.

- `earth-night-lights.jpg`
  - Source URL used: `https://commons.wikimedia.org/wiki/Special:Redirect/file/BlackMarble20161km.jpg?width=3840`
  - Source family: NASA Black Marble via Wikimedia Commons redirect.
  - Runtime size downloaded: 3840 x 1920.
  - Use in app: night-side city-light map.
  - Review note: verify the exact Wikimedia file page, NASA attribution, derivative resizing, and publication terms before public release.

- `earth-clouds.png`
  - Source URL used: `https://threejs.org/examples/textures/planets/earth_clouds_1024.png`
  - Source family: Three.js example texture.
  - Runtime size downloaded: 1024 x 512.
  - Use in app: independent transparent cloud layer.
  - Review note: this remains the weakest visual asset. Replace with a higher-resolution legally cleared transparent cloud map when available.

- `earth-normal.jpg`
  - Source URL used: `https://threejs.org/examples/textures/planets/earth_normal_2048.jpg`
  - Source family: Three.js example texture.
  - Runtime size downloaded: 2048 x 1024.
  - Use in app: subtle terrain normal perturbation.

- `earth-specular.jpg`
  - Source URL used: `https://threejs.org/examples/textures/planets/earth_specular_2048.jpg`
  - Source family: Three.js example texture.
  - Runtime size downloaded: 2048 x 1024.
  - Use in app: retained as a candidate ocean mask, but disabled in the current realistic rollback so it cannot darken or posterize the day map.

## Implementation note

The app does not use the user-provided reference screenshot as a spherical texture. That image is a perspective rendering, so it is used only as visual calibration for color, lighting, atmosphere, cloud opacity, and day-night transition.
