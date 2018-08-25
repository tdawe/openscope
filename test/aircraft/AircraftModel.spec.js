import ava from 'ava';
import AircraftModel from '../../src/assets/scripts/client/aircraft/AircraftModel';
import NavigationLibrary from '../../src/assets/scripts/client/navigationLibrary/NavigationLibrary';
import {
    createAirportControllerFixture,
    resetAirportControllerFixture,
    airportModelFixture
} from '../fixtures/airportFixtures';
import {
    createNavigationLibraryFixture,
    resetNavigationLibraryFixture
} from '../fixtures/navigationLibraryFixtures';
import {
    ARRIVAL_AIRCRAFT_INIT_PROPS_MOCK,
    ARRIVAL_AIRCRAFT_INIT_PROPS_WITH_SOFT_ALTITUDE_RESTRICTIONS_MOCK,
    DEPARTURE_AIRCRAFT_INIT_PROPS_MOCK
} from './_mocks/aircraftMocks';
import {
    FLIGHT_PHASE,
    PERFORMANCE
} from '../../src/assets/scripts/client/constants/aircraftConstants';
import { AIRPORT_CONSTANTS } from '../../src/assets/scripts/client/constants/airportConstants';

// mocks
const runwayNameMock = '19L';
const runwayModelMock = airportModelFixture.getRunway(runwayNameMock);

ava.beforeEach(() => {
    createNavigationLibraryFixture();
    createAirportControllerFixture();
});

ava.afterEach(() => {
    resetNavigationLibraryFixture();
    resetAirportControllerFixture();
});

ava('does not throw with valid parameters', (t) => {
    t.notThrows(() => new AircraftModel(DEPARTURE_AIRCRAFT_INIT_PROPS_MOCK));
});

ava('.matchCallsign() returns true when passed `*`', (t) => {
    const model = new AircraftModel(DEPARTURE_AIRCRAFT_INIT_PROPS_MOCK);

    t.true(model.matchCallsign('*'));
});

ava('.matchCallsign() returns false when passed a flightnumber that is not included in #callsign', (t) => {
    const model = new AircraftModel(DEPARTURE_AIRCRAFT_INIT_PROPS_MOCK);

    t.false(model.matchCallsign('42'));
});

ava('.matchCallsign() returns true when passed a flightnumber that is included in #callsign', (t) => {
    const model = new AircraftModel(DEPARTURE_AIRCRAFT_INIT_PROPS_MOCK);

    t.true(model.matchCallsign('1567'));
});

ava('.matchCallsign() returns true when passed a lowercase callsign that matches #callsign', (t) => {
    const model = new AircraftModel(DEPARTURE_AIRCRAFT_INIT_PROPS_MOCK);

    t.true(model.matchCallsign('ual1567'));
});

ava('.matchCallsign() returns true when passed a mixed case callsign that matches #callsign', (t) => {
    const model = new AircraftModel(DEPARTURE_AIRCRAFT_INIT_PROPS_MOCK);

    t.true(model.matchCallsign('uAl1567'));
});

ava('.getViewModel() includes an altitude that has not been rounded to the nearest foot', (t) => {
    const model = new AircraftModel(ARRIVAL_AIRCRAFT_INIT_PROPS_MOCK);
    model.mcp.altitude = 7777.1234567;

    const { assignedAltitude: result } = model.getViewModel();

    t.true(result === 77.77123456700001);
});

ava('.updateTarget() causes arrivals to descend when the STAR includes only AT or ABOVE altitude restrictions', (t) => {
    const model = new AircraftModel(ARRIVAL_AIRCRAFT_INIT_PROPS_WITH_SOFT_ALTITUDE_RESTRICTIONS_MOCK);
    model.positionModel = NavigationLibrary.findFixByName('LEMNZ').positionModel;

    model.groundSpeed = 320;
    model.updateTarget();

    t.true(model.target.altitude === 7000);
});

ava('.updateTarget() causes arrivals to descend when the STAR includes AT altitude restrictions', (t) => {
    const model = new AircraftModel(ARRIVAL_AIRCRAFT_INIT_PROPS_MOCK);
    model.positionModel = NavigationLibrary.findFixByName('MISEN').positionModel;

    model.groundSpeed = 320;
    model.updateTarget();

    t.true(model.target.altitude === 8000);
});

ava('.taxiToRunway() returns an error when the aircraft is airborne', (t) => {
    const expectedResult = [false, 'unable to taxi, we\'re airborne'];
    const arrival = new AircraftModel(ARRIVAL_AIRCRAFT_INIT_PROPS_MOCK);
    const arrivalResult = arrival.taxiToRunway(runwayModelMock);

    t.deepEqual(arrivalResult, expectedResult);

    const departure = new AircraftModel(DEPARTURE_AIRCRAFT_INIT_PROPS_MOCK);
    departure.altitude = 28000;

    const departureResult = departure.taxiToRunway(runwayModelMock);
    t.deepEqual(departureResult, expectedResult);
});

ava('.taxiToRunway() returns an error when the aircraft has landed', (t) => {
    const expectedResult = [false, 'uanble to taxi to runway, we have just landed'];
    const arrival = new AircraftModel(ARRIVAL_AIRCRAFT_INIT_PROPS_MOCK);
    arrival.altitude = arrival.fms.arrivalAirportModel.elevation;

    const arrivalResult = arrival.taxiToRunway(runwayModelMock);

    t.deepEqual(arrivalResult, expectedResult);
});

ava('.taxiToRunway() cancels IFR clearance if runway is invalid for the assigned SID', (t) => {
    const expectedResult = [
        true,
        {
            log: 'taxi to runway 01R',
            say: 'taxi to runway zero one right'
        }
    ];
    const model = new AircraftModel(DEPARTURE_AIRCRAFT_INIT_PROPS_MOCK);
    // BOACH6 is the only SID with an invalid runway
    model.fms.replaceFlightPlanWithNewRoute('KLAS07R.BOACH6.HEC');
    model.pilot.hasDepartureClearance = true;

    const invalidRunway = airportModelFixture.getRunway("01R");

    const result = model.taxiToRunway(invalidRunway);

    t.deepEqual(result, expectedResult);
    t.false(model.pilot.hasDepartureClearance);
});

ava('.taxiToRunway() returns a success message when finished', (t) => {
    const expectedResult = [
        true,
        {
            log: 'taxi to runway 19L',
            say: 'taxi to runway one niner left'
        }
    ];
    const model = new AircraftModel(DEPARTURE_AIRCRAFT_INIT_PROPS_MOCK);
    const result = model.taxiToRunway(runwayModelMock);

    t.deepEqual(result, expectedResult);
    t.deepEqual(model.flightPhase, FLIGHT_PHASE.TAXI);
    t.deepEqual(model.fms.departureRunwayModel, runwayModelMock);
});
