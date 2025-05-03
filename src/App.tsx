import { useRef, useEffect, useState, useCallback } from "react";
import {
	GoogleMap,
	LoadScript,
	Marker,
	DirectionsService,
	DirectionsRenderer,
} from "@react-google-maps/api";
import { ToastContainer, toast } from "react-toastify";
import {
	Location,
	SearchResultCard,
	AddedLocationCard,
} from "./components/locationCard";
import "bootstrap-icons/font/bootstrap-icons.css";
import anteaterImg from "./assets/anteater.png";

const googleAPIKey = "AIzaSyCDm-kHtEIsMQMo_VkGQ3pWDz_eu7S9O-0";
const libraries: "places"[] = ["places"];

const containerStyle = {
	width: "100%",
	height: "100vh",
};

function haversineDistance(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number
) {
	const toRad = (x: number) => (x * Math.PI) / 180;
	const R = 6371;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

type LocationLiteral = {
	lat: number;
	lng: number;
};

type LeaderBoardObj = {
	name: string;
	score: number;
};

function App() {
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [resultCards, setSearchResults] = useState<Location[]>([]);
	const [savedPlaces, setSavedPlaces] = useState<Location[]>([]);
	const [mapCenterLng] = useState(-117.842795);
	const [mapCenterLat] = useState(33.645933);

	const [totalDistance, setTotalDistance] = useState(0);
	const [totalTime, setTotalTime] = useState(0);
	const [isDriving, setIsDriving] = useState(false);

	const [leaderBoard, setLeaderBoard] = useState<LeaderBoardObj[]>([
		{
			name: "Jongmin",
			score: 1000,
		},
		{
			name: "Kyle",
			score: 300,
		},
		{
			name: "Mihir",
			score: 700,
		},
		{
			name: "Yumeng",
			score: 100,
		},
		{
			name: "You",
			score: 0,
		},
	]);

	const [wayPoints, setWayPoints] = useState<
		google.maps.DirectionsWaypoint[]
	>([]);

	const [totalScore, setTotalScore] = useState(0);
	const [rewardIndex, setRewardIndex] = useState(0);
	const REWARD_AMOUNT = 100;

	const [originLocation, setOriginLocation] = useState<LocationLiteral>({
		lat: 0,
		lng: 0,
	});

	const [directions, setDirections] =
		useState<google.maps.DirectionsResult | null>(null);
	const [originIndex, setOriginIndex] = useState(-1);

	const notify = (loc: string) => toast("Added " + loc);

	const [isLoading, setLoading] = useState(false);

	const handleSearch = async () => {
		if (!searchQuery.trim() || isLoading) return;
		setLoading(true);

		const request = {
			fields: ["displayName", "location", "formattedAddress", "photos"],
			textQuery: searchQuery,
			locationBias: {
				lat: 33.645933,
				lng: -117.842795,
			},
			language: "en-US",
			maxResultCount: 10,
			region: "us",
			useStrictTypeFiltering: false,
		};

		// Call searchByText passing the request.
		const { places } = await google.maps.places.Place.searchByText(request);

		const cardsData = places
			.map((place) => {
				const placeCard: Location = {
					name: place.displayName ?? "",
					address: place.formattedAddress ?? "",
					imgURL:
						place.photos && place.photos.length > 0
							? place.photos[0].getURI()
							: "",
					lat: place.location?.lat() ?? 0,
					lng: place.location?.lng() ?? 0,
				};
				console.log(placeCard);
				return placeCard;
			})
			.filter((card): card is Location => card !== null);

		if (cardsData.length > 0) {
			setSearchResults(cardsData);

			const randomRewardIndex = Math.floor(
				Math.random() * cardsData.length
			);
			setRewardIndex(randomRewardIndex);
			console.log(randomRewardIndex);
		}

		setLoading(false);
	};

	const mapRef = useRef<google.maps.Map | null>(null);

	const onLoad = (map: google.maps.Map): void => {
		mapRef.current = map;
	};

	useEffect(() => {
		if (mapRef.current) {
			mapRef.current.panTo({ lat: mapCenterLat, lng: mapCenterLng });
			mapRef.current.setZoom(17);
		}
	}, [mapCenterLat, mapCenterLng]);

	useEffect(() => {
		if (searchQuery === "") {
			setSearchResults([]);
		}
	}, [searchQuery]);

	useEffect(() => {
		setDirections(null);
		if (originIndex === -1) {
			return;
		}

		const wayPoints = savedPlaces
			.filter((_, index) => index !== originIndex)
			.map((item) => {
				return {
					location: {
						lat: item.lat,
						lng: item.lng,
					},
					stopover: true,
				};
			});

		setWayPoints(wayPoints);
	}, [savedPlaces, originIndex]);

	const handleDirectionsCallback = useCallback(
		(
			response: google.maps.DirectionsResult | null,
			status: google.maps.DirectionsStatus
		) => {
			if (status === "OK" && response) {
				setDirections(response);
				let distance = 0;
				let travel_time = 0;
				response.routes[0].legs.map((leg) => {
					distance += leg.distance?.value ?? 0;
					travel_time += leg.duration?.value ?? 0;
				});

				setTotalDistance(distance / 1600);
				setTotalTime(travel_time);
			} else {
				console.error("Directions request failed:", status);
			}
		},
		[]
	);

	const handleMapClick = async (e: google.maps.MapMouseEvent) => {
		// Only process if it's a POI
		if (e.latLng) {
			e.stop(); // Prevent default click behavior (e.g., opening place details)

			const request = {
				fields: [
					"displayName",
					"location",
					"formattedAddress",
					"photos",
				],
				locationRestriction: {
					center: e.latLng,
					radius: 50,
				},
				language: "en-US",
				maxResultCount: 1,
				region: "us",
			};

			// Call searchByText passing the request.
			const { places } = await google.maps.places.Place.searchNearby(
				request
			);
			const cardsData = places
				.map((place) => {
					const placeCard: Location = {
						name: place.displayName ?? "",
						address: place.formattedAddress ?? "",
						imgURL:
							place.photos && place.photos.length > 0
								? place.photos[0].getURI()
								: "",
						lat: place.location?.lat() ?? 0,
						lng: place.location?.lng() ?? 0,
					};
					console.log(placeCard);
					return placeCard;
				})
				.filter((card): card is Location => card !== null);

			if (cardsData.length > 0) {
				setSearchQuery(cardsData[0].name);
				setSearchResults(cardsData);

				const randomRewardIndex = Math.floor(
					Math.random() * cardsData.length
				);
				setRewardIndex(randomRewardIndex);
			}
		}
	};

	useEffect(() => {
		let leaderBoardCopy = leaderBoard
			.map((item) => {
				if (item.name === "You") {
					return {
						name: "You",
						score: totalScore,
					};
				} else {
					return item;
				}
			})
			.sort((a, b) => b.score - a.score);
		setLeaderBoard(leaderBoardCopy);
	}, [totalScore]);

	return (
		<div className="relative h-screen w-screen flex flex-row bg-black/95 text-white">
			<ToastContainer
				position="top-right"
				autoClose={1500}
				hideProgressBar
				newestOnTop={false}
				closeOnClick={false}
				rtl={false}
				pauseOnFocusLoss={false}
				draggable
				pauseOnHover={false}
				theme="light"
			/>
			{/* Map */}
			<div className="relative flex-1 h-full">
				<LoadScript
					googleMapsApiKey={googleAPIKey}
					libraries={libraries}
				>
					<GoogleMap
						mapContainerStyle={containerStyle}
						center={{
							lat: mapCenterLat,
							lng: mapCenterLng,
						}}
						onLoad={onLoad}
						zoom={17}
						onClick={handleMapClick}
						options={{
							mapTypeControl: false,
							clickableIcons: true,
						}}
					>
						{directions
							? null
							: savedPlaces.map((loc, idx) => (
									<Marker
										key={idx}
										position={loc}
										label={{
											text: `${idx + 1}`,
											color: "white",
											fontSize: "14px",
											fontWeight: "bold",
										}}
									/>
							  ))}

						{!directions && originIndex !== -1 && (
							<DirectionsService
								options={{
									origin: originLocation,
									destination: originLocation,
									waypoints: wayPoints,
									travelMode: isDriving
										? google.maps.TravelMode.DRIVING
										: google.maps.TravelMode.WALKING,
									optimizeWaypoints: true,
								}}
								callback={handleDirectionsCallback}
							/>
						)}

						{directions && originIndex !== -1 && (
							<DirectionsRenderer
								directions={directions}
								options={{
									draggable: true,
								}}
							/>
						)}
					</GoogleMap>
				</LoadScript>

				<div className="w-1/6 absolute top-10 right-20 gap-3 border-1 border-white/20 rounded-xl p-3 flex flex-col bg-black/80 text-lg">
					<span>Total Distance:</span>
					<span className="w-full flex justify-center">
						{totalDistance.toFixed(2)} Miles
					</span>{" "}
					<span>Total Time:</span>
					{totalTime > 3600 ? (
						<span className="w-full flex justify-center">
							{" "}
							{(totalTime / 3600).toFixed(0)} Hours{" "}
							<span className="pl-1">
								{" "}
								{((totalTime % 3600) / 60).toFixed(0)} Minutes
							</span>
						</span>
					) : (
						<span className="w-full flex justify-center">
							{" "}
							{(totalTime / 60).toFixed(1)} Minutes{" "}
						</span>
					)}
					<div className="flex gap-2">
						<input
							type="checkbox"
							checked={isDriving}
							onChange={(e) => {
								setIsDriving(e.target.checked);
								setDirections(null);
							}}
						></input>{" "}
						<label>Driving</label>
					</div>
				</div>
			</div>

			<div className="w-1/6 absolute right-20 bottom-10 flex flex-col p-3 justify-center border-1 border-white/20 rounded-xl bg-black/80 text-lg gap-5">
				<span className="text-3xl font-medium">Leader Board</span>
				<div className="flex flex-col ">
					{leaderBoard.map((item, index) => (
						<div className="flex gap-3 w-full justify-between" key={index}>
							<span
								className={
									item.name === "You" ? "text-purple-400" : ""
								}
							>
								{item.name}
							</span>
							<span>{item.score}</span>
						</div>
					))}
				</div>
			</div>

			{/* Search bar */}
			<div className="absolute left-0 flex flex-col gap-5 p-10 h-full bg-neutral-800/0 overflow-scroll max-w-3/7 no-scrollbar">
				<div className="flex flex-row items-center">
					<span className="text-7xl font-semibold text-blue-500">
						Zot<span className="text-yellow-400">Tripper</span>
					</span>
					<img src={anteaterImg} className="w-50 h-full" />
				</div>

				<div className="flex flex-row gap-5 items-center">
					<div className="bg-neutral-600 border-1 border-white/10 rounded-md p-2 w-100 flex gap-2 justify-between">
						<input
							type="text"
							className="w-full"
							onChange={(e) => setSearchQuery(e.target.value)}
							value={searchQuery}
							placeholder="Search for places to visit in UC Irvine"
						/>
						<i
							className="bi bi-x-circle text-2xl font-medium text-gray-400 hover:text-red-500"
							onClick={() => {
								setSearchQuery("");
							}}
						></i>
					</div>
					<button
						type="button"
						className="rounded-md bg-purple-500 px-5 py-2 h-full whitespace-nowrap hover:bg-purple-700"
						onClick={() => {
							handleSearch();
						}}
					>
						Search
					</button>
				</div>
				
				{searchQuery !== ""
					? resultCards.map((item, index) => (
							<div
								key={index}
								onClick={() => {
									if (mapRef.current) {
										mapRef.current.panTo({
											lat: mapCenterLat,
											lng: mapCenterLng,
										});
										mapRef.current.setZoom(17);
									}
								}}
							>
								<SearchResultCard
									{...item}
									doReward={
										index === rewardIndex &&
										haversineDistance(
											item.lat,
											item.lng,
											33.645933,
											-117.842795
										) < 5
									}
									onClickAdd={() => {
										notify(item.name);
										if (
											!savedPlaces.some(
												(saved) =>
													saved.address ==
													item.address
											)
										) {
											if (
												index === rewardIndex &&
												haversineDistance(
													item.lat,
													item.lng,
													33.645933,
													-117.842795
												) < 5
											) {
												setTotalScore(
													totalScore + REWARD_AMOUNT
												);
												console.log(totalScore);
											}
											setSavedPlaces([
												...savedPlaces,
												item,
											]);
											if (savedPlaces.length === 0) {
												setOriginIndex(0)
											}
										}
									}}
								></SearchResultCard>
							</div>
					  ))
					: savedPlaces.map((item, index) => (
							<div
								key={index}
								onClick={() => {
									if (mapRef.current) {
										mapRef.current.panTo({
											lat: mapCenterLat,
											lng: mapCenterLng,
										});
										mapRef.current.setZoom(17);
									}
								}}
							>
								<AddedLocationCard
									{...item}
									isOrigin={originIndex === index}
									onClickRemove={() => {
										notify("Removed " + item.name);
										setSavedPlaces(
											savedPlaces.filter(
												(_, currentIndex) =>
													index !== currentIndex
											)
										);
										if (originIndex === index) {
											setOriginIndex(-1);
											setTotalDistance(0);
											setTotalTime(0);
										}
										if (index < originIndex) {
											setOriginIndex(originIndex - 1);
										}
										setTotalScore(
											Math.max(totalScore - REWARD_AMOUNT, 0)
										);
										console.log(totalScore);
									}}
									onClickSetOrigin={() => {
										notify("New origin: " + item.name);
										setOriginIndex(index);
										setOriginLocation({
											lat: item.lat,
											lng: item.lng,
										});
									}}
								></AddedLocationCard>
							</div>
					  ))}
			</div>
		</div>
	);
}

export default App;
