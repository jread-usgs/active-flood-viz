(function () {
		'use strict';
		/**
		 * @param {Object} options - holds options for the configuration of the map.
		 * All keys are required.
		 * Keys include:
		 *    @prop 'height' v(int) - height of the map
		 *    @prop 'width' v(int) - width of the map
		 *    @prop 'proj' v(proj4) - map projection
		 *    @prop 'bounds' v(javascript object) - bounding box
		 *    @prop 'scale' v(int) - scale for map
		 *    @prop 'bg_data' v(javascript object) - background data
		 *    @prop 'rivers_data' v(geojson) - rivers data
		 *    @prop 'ref_data' v(javascript object) - reference data
		 *    @prop 'site_data' v(javascript object) - site data
		 *    @prop 'div_id' v(string) - id for the container for this graph
		 *
		 * mapmodule is a module for creating maps using d3. Pass it a javascript object
		 * specifying config options for the map. Call init() to create the map. Linked
		 * interaction functions for other figures should be passed to init in and object.
		 *
		 * @return {Object} self - Holder for public functions.
		 *    See functions for specific documentation.
		 *    @function init
		 *    @function site_tooltip_show
		 *    @function site_tooltip_remove
		 *    @function site_add_accent
		 *    @function site_remove_accent
		 *
		 */
		FV.mapmodule = function (options) {

			var self = {};

			// Stores SVG coordinates of gages and the size and location of the selection box
			var state = {};

			var height = 350;
			var width = 550 * options.width / options.height;

			var project = function (lambda, phi) {
				return options.proj.forward([lambda, phi].map(radiansToDegrees));
			};
			project.invert = function (x, y) {
				return options.proj.inverse([x, y]).map(degreesToRadians);
			};
			//Define map projection
			var projection = d3.geoProjection(project);
			// Give projection initial rotation and scale
			projection.scale(1).translate([0, 0]);
			//Define path generator
			var path = d3.geoPath().projection(projection);
			//Create SVG element
			var svg = null;
			// Tooltip
			var maptip = null;
			// Google Analytics Boolean Trackers
			var map_moused_over_gage = {};

			/**
			 * Add circles to the map.
			 * @param data The geojson to be added to the svg
			 * @param classname The class to be given to each element for use in CSS
			 * @param radius The radius of each circle. This cannot be set from CSS
			 * @param property_for_id The name of a field in the 'properties' of each feature, to be used for ID
			 *                            If null, or not provided, no id will be given.
			 *
			 * @return group The group that has been appended to the SVG
			 */
			var add_circles = function (data, classname, radius, property_for_id) {
				var group = svg.append('g');
				group.selectAll('circle')
					.data(data.features)
					.enter()
					.append('circle')
					.attr('r', radius)
					.attr('cx', function (d) {
						return projection(d.geometry.coordinates)[0]
					})
					.attr('cy', function (d) {
						return projection(d.geometry.coordinates)[1]
					})
					.attr('id', function (d) {
						if (property_for_id && d.properties[property_for_id]) {
							return 'map' + d.properties[property_for_id];
						}
						else {
							return '';
						}
					})
					.attr('class', classname);
				return (group);
			};
			/**
			 * Add paths to the map
			 * @param data The geojson to be added to the svg
			 * @param classname The class to be given to each element for use in CSS
			 *
			 * @return group The group that has been appended to the SVG
			 */
			var add_paths = function (data, classname) {
				var group = svg.append('g');
				group.selectAll('path')
					.data(data.features)
					.enter()
					.append('path')
					.attr('d', path)
					.attr('class', classname);
				return group;
			};

			/**
			 * Add or remove the line corresponding to a gage from the hydrograph
			 * @param sitekey THe ID of the gage in question
			 */
			var toggle_hydrograph_display = function (sitekey) {
				var new_display_ids = FV.hydrograph_display_ids;
				var being_displayed = new_display_ids.indexOf(sitekey) !== -1;
				if (being_displayed === true) {
					self.site_remove_accent(sitekey);
					new_display_ids.splice(new_display_ids.indexOf(sitekey), 1);
					self.linked_interactions.hover_out(sitekey);
				}
				else {
					self.site_add_accent(sitekey);
					new_display_ids.push(sitekey);
					self.linked_interactions.hover_in(sitekey);
				}
				self.linked_interactions.click(new_display_ids);
				self.linked_interactions.hover_in(sitekey);
			};

			/**
			 * Starts a click-and-drag box to select gages
			 * @param point Location of the mouse on the svg
			 */
			var select_box_start = function (point) {
				svg.append('rect')
					.attr('x', point[0])
					.attr('y', point[1])
					.attr('height', 0)
					.attr('width', 0)
					.attr('class', 'select-box')
					.attr('id', 'map-select-box');

				state.box = {
					x: point[0],
					y: point[1],
					height: 0,
					width: 0
				};
			};

			/**
			 * Change the size and shape of the selection box based on new mouse location
			 * @param point Location of the mouse on the svg
			 */
			var select_box_drag = function (point) {
				var box = d3.select('#map-select-box');
				if (!box.empty()) {
					var d = {
						x: parseInt(box.attr('x')),
						y: parseInt(box.attr('y')),
						width: parseInt(box.attr('width')),
						height: parseInt(box.attr('height'))
					};

					for (var i = 0; i < point.length; i++) {
						point[i] = Math.round(point[i]);
					}

					var move = {
						x: point[0] - d.x,
						y: point[1] - d.y
					};

					if (move.x < 1 || (move.x * 2 < d.width)) {
						d.x = point[0];
						d.width -= move.x;
					}
					else {
						d.width = move.x;
					}

					if (move.y < 1 || (move.y * 2 < d.height)) {
						d.y = point[1];
						d.height -= move.y;
					}
					else {
						d.height = move.y;
					}

					box.attr('x', d.x)
						.attr('y', d.y)
						.attr('width', d.width)
						.attr('height', d.height);

					state.box = {
						x: d.x,
						y: d.y,
						height: d.height,
						width: d.width
					};
				}
			};

			/**
			 * End the selection box, get rid of the box in state and on the svg,
			 * update the hydrograph and map if necessary
			 */
			var select_box_end = function () {
				// Check if the box has a reasonable area to make sure it isn't a click by mistake
				var area = state.box.width * state.box.height;
				if (area >= 100) {
					// x and y always denote the NW corner, height denotes how far south
					// and width how far east the box extends.
					var NW = {
						x: state.box.x,
						y: state.box.y
					};
					var SE = {
						x: NW.x + state.box.width,
						y: NW.y + state.box.height
					};
					var selected = FV.hydrograph_display_ids;

					const keys = Object.keys(state.gages);

					keys.forEach(function (key) {
						const g = state.gages[key];
						if (
							selected.indexOf(g.id) === -1 &&
							g.x > NW.x && g.x < SE.x &&
							g.y > NW.y && g.y < SE.y
						) {
							selected.push(key);
							self.site_add_accent(key);
						}
					});
					self.linked_interactions.click(selected);
					FV.ga_send_event('Map', 'drag_select', selected.join(','));
				}
				state.box = {};
				svg.select('#map-select-box').remove();
			};

			/**
			 * Initialize the Map.
			 *
			 *@param {Object} linked_interactions - Object holding functions that link to another figure's interactions.
			 *                                        Pass null if there are no such interactions to link.
			 *        @prop 'hover_in' - linked interaction function for hover_in events on this figure.
			 *        @prop 'hover_out' - linked interaction function for hover_out events on this figure.
			 *        @prop 'click' - linked interaction function for click events on this figure.
			 *
			 */
			self.init = function (linked_interactions) {

				self.linked_interactions = linked_interactions;

				if (svg !== null) {
					d3.select(options.div_id).select('svg').remove();
				}
				svg = d3.select(options.div_id)
					.append('svg')
					.attr("preserveAspectRatio", "xMinYMin meet")
					.attr("viewBox", "0 0 " + width + " " + height);

				state.edges = {
					l: 0,
					r: width,
					t: 0
				};


				// Define the drag behavior to be used for the selection box
				var drag = d3.drag()
					.on('start', function () {
						var p = d3.mouse(this);
						select_box_start(p);
					})
					.on('drag', function () {
						var p = d3.mouse(this);
						select_box_drag(p);
					})
					.on('end', function () {
						select_box_end();
					});

				svg.call(drag);

				// set bounding box to values provided
				var b = path.bounds(options.bounds);
				var s = options.scale / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height);
				var t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];
				// Update the projection
				projection.scale(s).translate(t);
				// Add layers
				add_paths(options.bg_data, 'background');
				add_paths(options.rivers_data, 'river');
				add_circles(options.ref_data, 'ref-point', 2);

				// Save locations of gages in SVG for later use with selection box
				state.gages = {};
				options.site_data.features.forEach(function (g) {
					var position = projection(g.geometry.coordinates);
					state.gages[g.properties.id] = {
						x: position[0],
						y: position[1],
						accent: false
					};
				});

				// Add sites and bind events for site hovers
				var sites = add_circles(options.site_data, 'gage-point', 3, 'id');
				sites.selectAll('circle')
					.on('mouseover', function (d) {
						self.site_tooltip_show(d.properties.name, d.properties.id);
						self.linked_interactions.hover_in(d.properties.id);
						// Only log first hover of gage point per session
						if (map_moused_over_gage[d.properties.id] === undefined) {
							FV.ga_send_event('Map', 'hover_gage', d.properties.id);
							map_moused_over_gage[d.properties.id] = true;
						}
					})
					.on('mouseout', function (d) {
						self.site_tooltip_remove();
						self.linked_interactions.hover_out(d.properties.id);
					})
					.on('click', function (d) {
						toggle_hydrograph_display(d.properties.id);
						FV.ga_send_event('Map', 'gage_click_on', d.properties.id);
					})
					.on('mousedown', function () {
						d3.event.stopPropagation();
					});

				sites.selectAll('circle').each(function (d) {
					if (FV.hydrograph_display_ids.indexOf(d.properties.id) !== -1) {
						self.site_add_accent(d.properties.id);
					}
				});

				// Debug points
				if (FV.config.debug) {
					add_circles(options.bounds, 'debug-point', 3)
				}

				// Add maptip skeleton
				maptip = svg.append('g')
					.attr('class', 'maptip-hide')
					.attr('id', 'maptip');
				// I'm abbreviating 'maptip' to 'mt' in these IDs to clarify that they are children of the maptip group
				maptip.append('rect')
					.attr('id', 'mt-text-background');
				maptip.append('polyline')
					.attr('id', 'mt-arrow');
				maptip.append('text')
					.attr('id', 'mt-text');
			};

			/**
			 * Shows sitename tooltip on map figure at correct location.
			 */
			self.site_tooltip_show = function (sitename, sitekey) {
				const padding = 4;
				const arrowheight = 17;

				const sidelength = arrowheight / 0.866;


				const gage = d3.select('#map' + sitekey);
				const gagelocation = {
					x: parseFloat(gage.attr('cx')),
					y: parseFloat(gage.attr('cy'))
				};


				maptip.attr('transform', 'translate(' + gagelocation.x + ', ' + gagelocation.y + ')')
					.attr('class', 'maptip-show');
				const tiptext = maptip.select('#mt-text');

				// I have to set the text before I can check if it collides with the edges,
				// but I can check if it collides with the top without bumping it up; I only use its height.
				tiptext.html(sitename);

				const textbg = maptip.select('#mt-text-background');
				const textbound = tiptext._groups[0][0].getBBox();

				const tipedges = {
					l: gagelocation.x - textbound.width / 2,
					r: gagelocation.x + textbound.width / 2,
					t: gagelocation.y - textbound.height - arrowheight
				};

				/*
				* EXPLANATION OF `t`.
				* t for Top. This is set to -1 to draw the tooltip under the gage rather than above it.
				* In many places I was negating positive values (eg -x) before use to yield and upward offset.
				* In those places I now use (-t * x) to achieve an upward offset when t = 1
				* and a downward offset when t = -1.
				*/
				var adjust = {
					'l': 0,
					'r': 0,
					't': 1
				};

				if (tipedges.l < state.edges.l) {
					console.log('left');
					// this will be positive so it will be a shift to the right
					adjust.l = state.edges.l - tipedges.l
				}
				else if (tipedges.r > state.edges.r) {
					console.log('right');
					// this will be negative, so a shift to the left
					adjust.r = state.edges.r - tipedges.r
				}
				if (tipedges.t < state.edges.t) {
					console.log('top');
					// set t to -1 so that the tooltip will bw drawn under the gage.
					adjust.t = -1
				}

				const points = [[0, 0], [-(sidelength / 2), -adjust.t * arrowheight], [(sidelength / 2), -adjust.t * arrowheight], [0, 0]];

				// turn points array into string
				var arrowpoints = '';
				points.forEach(function (p) {
					arrowpoints += p[0] + ' ' + p[1] + ',';
				});
				arrowpoints = arrowpoints.substring(0, arrowpoints.length - 1);

				const arrow = maptip.select('#mt-arrow');
				arrow.attr('points', arrowpoints);

				tiptext.attr('y', (-adjust.t * (arrowheight + padding * 2)));

				/*
				 * The y on the text points to the upper edge, so it requires a bit of adjustment when showing
				 * the tooltip below the gage.
				 * I think this is better than adding some byzantine math to the initial setting.
				 */
				if(adjust.t === -1){
					var scootdist = parseFloat(tiptext.attr('y'));
					scootdist += textbound.height / 2;
					tiptext.attr('y', scootdist);
				}

				tiptext.attr('transform', 'translate(' + (adjust.l + adjust.r) + ', 0)');
				// One of adjust.l or adjust.r should always be 0.
				textbg.attr('x', textbound.x - padding + adjust.l + adjust.r)
					.attr('y', tiptext.attr('y') - textbound.height + (adjust.t * 0.5))
					.attr('width', textbound.width + padding * 2)
					.attr('height', textbound.height + padding * 2);

			};
			/**
			 * Removes tooltip style from map site.
			 */
			self.site_tooltip_remove = function () {
				maptip.attr('class', 'maptip-hide');
			};

			/**
			 * Remove/Add accent for a svg circle representing a site.
			 * Used by hydromodule for cross figure interactions.
			 */
			self.site_remove_accent = function (sitekey) {
				state.gages[sitekey].accent = false;
				d3.select('#map' + sitekey).attr('class', 'gage-point');
			};
			self.site_add_accent = function (sitekey) {
				state.gages[sitekey].accent = true;
				d3.select('#map' + sitekey).attr('class', 'gage-point-accent');
			};

			return self;
		};
	}()
);


// Define helper functions
function degreesToRadians(degrees) {
	'use strict';
	return degrees * Math.PI / 180;
}

function radiansToDegrees(radians) {
	'use strict';
	return radians * 180 / Math.PI;
}
