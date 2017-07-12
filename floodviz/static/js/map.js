(function() {
	"use strict";
	/**
		* @param {Javascript Object} options - holds options for the configuration of the map.
		* All keys are not optional.
		* Keys include: 	
		* 					'height' v(int) - height of the map 
		*					'width' v(int) - width of the map
		*					'proj' v(proj4) - map projection
		*					'bounds' v(javascript object) - bounding box
		*					'scale' v(int) - scale for map
		*					'bg_data' v(javascript object) - background data
		*					'rivers_data' v(geojson) - rivers data
		*					'ref_data' v(javascript object) - reference data
		*					'site_data' v(javascript object) - site data
		*					'div_id' v(string) - id for the container for this graph
		*
		* mapmodule is a module for creating maps using d3. Pass it a javascript object 
		* specifying config options for the map. Call init() to create the map. Other pulic fuctions
		* handle user events and link to other modules. 
		* 
	*/
	FV.mapmodule = function (options) {

		var self = {};
		var height = options.height;
		var width = options.width;
		var proj = options.proj;
		var sel_div = options.div_id;
		var project = function (lambda, phi) {
			return proj.forward([lambda, phi].map(radiansToDegrees));
		};
		project.invert = function (x, y) {
			return proj.inverse([x, y]).map(degreesToRadians);
		};
		//Define map projection
		var projection = d3.geoProjection(project);
		// Give projection initial rotation and scale
		projection.scale(1).translate([0, 0]);
		//Define path generator
		var path = d3.geoPath().projection(projection);
		//Create SVG element
		var svg = d3.select(sel_div)
			.append("svg")
			.attr("width", width)
			.attr("height", height);
		// Tooltip
		var maptip = d3.select("body")
			.append("div")
			.attr("id", "maptip");
		
		/**
		 * Add circles to the map.
		 * @param data The geojson to be added to the svg
		 * @param classname The class to be given to each element for use in CSS
		 * @param radius The radius of each circle. This cannot be set from CSS
		 */
		var add_circles = function (data, classname, radius) {
			var group = svg.append("g");
			group.selectAll("circle")
				.data(data.features)
				.enter()
				.append("circle")
				.attr("r", radius)
				.attr("transform", function (d) {
					return "translate(" + projection(d.geometry.coordinates) + ")";
				})
				.attr("id", function(d) {
					if (classname === 'gage-point') {
						return 'map' + d.properties.id;
					} else { return '';}
				})
				.attr("class", classname);
			return (group);
		};
		/**
		 * Add paths to the map
		 * @param data The geojson to be added to the svg
		 * @param classname The class to be given to each element for use in CSS
		 */
		var add_paths = function (data, classname) {
			var group = svg.append("g");
			group.selectAll("path")
				.data(data.features)
				.enter()
				.append("path")
				.attr("d", path)
				.attr("class", classname);
		};
		
		/**
		 * Initalize the Map
		 */
		self.init = function() {
			
			// set bounding box to values provided
			var b = path.bounds(options.bounds);
			var s = options.scale / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height);
			var t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];
			// Update the projection
			projection.scale(s).translate(t);
			// Add layers
			add_paths(options.bg_data, "background");
			add_paths(options.rivers_data, "river");
			add_circles(options.ref_data, "ref-point", 2);
			// Add sites and bind events for site hovers
			var sites = add_circles(options.site_data, "gage-point", 3);
			sites.selectAll("circle")
				.on('mousemove', function(d) {return self.mousemove(d.properties.name, d.properties.id)})
				.on("mouseout", function() {return self.mouseout()});
			// Debug points
			if (FV.mapinfo.debug) {
				add_circles(FV.mapinfo.bounds, "debug-point", 3)
			}
		};
		/**
		 * Handle all mouse over movements for calling element. 
		 */
		self.mousemove = function (sitename, sitekey) {
			var gage_point_cords = document.getElementById('map'+sitekey).getBoundingClientRect();
			maptip.transition().duration(500);
			maptip.style("display", "inline-block")
				.style("left", (gage_point_cords.left) + 7 + "px")
				.style("top", (gage_point_cords.top - 45) + "px")
				.html((sitename));
			// Link interactions with hydrograph here

		};
		/**
		 * Handle all mouse out movements for calling element. 
		 */
		self.mouseout = function () {
			maptip.style("display", "none");
			// Link interactions with hydrograph here
		};
		/**
		 * Remove accent for a svg circle representing a site. 
		 * Used primarily by hydromodule for cross figure interactions. 
		 */
		self.removeaccent = function(sitekey) {
			var point = document.getElementById('map' + sitekey);
			point.classList.remove('accent');
			// Link interactions with hydrograph here
		};
		return self 
	};

}());

// Define helper functions
function degreesToRadians(degrees) {
	"use strict";
	return degrees * Math.PI / 180;
}

function radiansToDegrees(radians) {
	"use strict";
	return radians * 180 / Math.PI;
}

